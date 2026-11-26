//! Resumable durable epochs. A changed writer generation invalidates all planned victims.
use super::{idb, idb_commit, idb_events, idb_retention_scan};
use lkjstr_core::{
    cache::{
        self,
        durable::{self, Access, Scan, State},
    },
    optimizer::retention::WORK,
};
use std::{collections::BTreeSet, rc::Rc};
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use web_sys::IdbDatabase;
#[path = "idb_retention_write.rs"]
mod writing;
pub(super) use writing::{hint, write};
type Observe = dyn Fn(&BTreeSet<String>) -> Option<Access>;

pub async fn run(
    db: &IdbDatabase,
    latest: impl Fn(&BTreeSet<String>) -> Option<Access> + 'static,
) -> Result<bool, String> {
    let latest = Rc::new(latest);
    let raw = idb::kv_get(db, durable::KEY).await?;
    let state = State::read(raw.as_deref());
    let count = idb::count_events(db).await? as usize;
    if !state.needed(count) {
        return Ok(false);
    }
    // No graph allocation on a clean warm startup; snapshot only a needed epoch.
    let access = latest(&BTreeSet::new()).ok_or("retention stopped")?;
    let checkpoint = idb::kv_get(db, cache::METADATA_KEY).await?;
    let references = cache::metadata_references(checkpoint.as_deref()).map_err(str::to_owned)?;
    let metadata = idb_events::metadata(db).await?;
    let mut scan = Scan::new(state, access, &metadata);
    scan.required
        .extend(references.into_iter().map(|reference| reference.id));
    let mut after = None;
    loop {
        let (rows, next) = idb_retention_scan::page(db, after.as_deref()).await?;
        for (row, hint) in rows {
            scan.push(&row, hint);
            if scan.used.total() > count {
                // Another writer grew the snapshot. Retry from its generation;
                // legacy stores larger than the normal budget still make progress.
                return Ok(true);
            }
        }
        after = next;
        if after.is_none() {
            break;
        }
    }
    let access = latest(&scan.authors()).ok_or("retention stopped")?;
    scan.reweight(access.authors);
    let mut held = access.held;
    // Newly selected accounts may protect policies that were not pinned at epoch start.
    if access.own != scan.access.own {
        return Ok(true);
    }
    held.extend(scan.protected.iter().cloned());
    let mut victims = Vec::new();
    loop {
        victims.extend(scan.victims(WORK, &held));
        if victims.len() >= WORK || scan.state.epoch.is_none() || scan.exhausted() {
            break;
        }
        // IDB completion provides a task boundary without a spinning microtask loop.
        let _ = idb::kv_get(db, durable::KEY).await?;
    }
    let current = latest(&BTreeSet::new()).ok_or("retention stopped")?;
    if current.own != scan.access.own || !current.held.is_subset(&held) {
        return Ok(true);
    }
    let remaining = scan.state.epoch.is_some();
    let saved =
        serde_json::to_string(&scan.state).map_err(|_| "retention state encoding failed")?;
    commit(
        db,
        raw,
        saved,
        victims.into_iter().map(|row| row.id).collect(),
        latest,
        scan.access.own,
        held,
    )
    .await?;
    Ok(remaining)
}
async fn commit(
    db: &IdbDatabase,
    expected: Option<String>,
    next: String,
    victims: BTreeSet<String>,
    latest: Rc<Observe>,
    own: BTreeSet<String>,
    held: BTreeSet<String>,
) -> Result<(), String> {
    let mut callback = None;
    let mut request_guard = None;
    let result = idb_commit::commit_stores(db, &["events", "kv"], |tx| {
        let kv = tx.object_store("kv")?;
        let events = tx.object_store("events")?;
        let request = kv.get(&durable::KEY.into())?;
        let current = request.clone();
        let tx = tx.clone();
        let step = Closure::<dyn FnMut(web_sys::Event)>::new(move |_| {
            let commit = || -> Result<(), JsValue> {
                if current.result()?.as_string() != expected {
                    return Err("stale retention epoch".into());
                }
                let access = latest(&BTreeSet::new()).ok_or("retention stopped")?;
                if access.own != own || !access.held.is_subset(&held) {
                    return Err("retention pins changed".into());
                }
                for id in &victims {
                    events.delete(&id.as_str().into())?;
                }
                kv.put_with_key(&next.as_str().into(), &durable::KEY.into())?;
                Ok(())
            };
            if commit().is_err() {
                let _ = tx.abort();
            }
        });
        request.set_onsuccess(Some(step.as_ref().unchecked_ref()));
        request_guard = Some(request);
        callback = Some(step);
        Ok(())
    })
    .await;
    if let Some(request) = request_guard {
        request.set_onsuccess(None);
    }
    drop(callback);
    result
}
