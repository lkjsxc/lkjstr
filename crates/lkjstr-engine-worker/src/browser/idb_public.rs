//! Public-only stored references and one-time metadata migration. Account state is untouched.
use super::{idb, idb_events, idb_public_scan};
use lkjstr_core::cache::{self, Record};
use web_sys::{AbortSignal, IdbDatabase};
const MIGRATION: &str = "verified-public-metadata-scan-v1";

pub async fn metadata(db: &IdbDatabase, signal: &AbortSignal) -> Result<Vec<Record>, String> {
    let progress = idb::kv_get(db, MIGRATION).await?;
    let cached = idb_events::metadata(db).await;
    if progress.as_deref() == Some("done") && cached.is_ok() {
        return cached;
    }
    let mut after = progress.filter(|key| lkjstr_protocol::is_event_id(key));
    if cached.is_err() {
        after = None;
    }
    let started = super::storage_inspection::now();
    // Ordinary storage is capped at 20,000 rows. Byte-heavy or slow legacy
    // stores resume at the committed cursor on the next boot; absence is never
    // inferred from a partial pass. Held screen references hydrate separately.
    for page in 0..626 {
        if signal.aborted() {
            return Err("Cache migration stopped".into());
        }
        if page > 0
            && started
                .zip(super::storage_inspection::now())
                .is_some_and(|(from, to)| to.saturating_sub(from) >= 3000)
        {
            break;
        }
        let (rows, next) = idb_public_scan::page(db, after.as_deref()).await?;
        let verified: Vec<_> = rows.iter().filter_map(cache::validate_metadata).collect();
        if !verified.is_empty() {
            idb_events::put(db, &verified).await?;
        }
        if next.is_none() {
            idb::kv_put(db, MIGRATION, "done").await?;
            return idb_events::metadata(db).await;
        }
        after = next;
        // The cursor follows the committed metadata, never precedes it.
        if page % 16 == 15
            && let Some(after) = &after
        {
            idb::kv_put(db, MIGRATION, after).await?;
        }
    }
    if let Some(after) = after {
        idb::kv_put(db, MIGRATION, &after).await?;
    }
    idb_events::metadata(db).await
}

pub async fn references(
    db: &IdbDatabase,
    ids: &[String],
) -> Result<(Vec<Record>, Vec<String>), String> {
    let mut rows = Vec::new();
    let mut scanned = Vec::new();
    let mut bytes = 0;
    for id in ids.iter().take(32) {
        let tx = db
            .transaction_with_str("events")
            .map_err(|_| "Cache read transaction failed")?;
        let request = tx
            .object_store("events")
            .map_err(|_| "Cache read store missing")?
            .get(&id.as_str().into())
            .map_err(|_| "Cache read failed")?;
        let value = idb::settle(&request);
        let result = super::promise::bounded(value, 15, "Cache read timed out", move || {
            let _ = tx.abort();
        })
        .await
        .map_err(|_| "Cache read failed")?;
        let row = idb_events::read(result).and_then(|row| cache::validate_public_reference(&row));
        if row
            .as_ref()
            .is_some_and(|row| bytes + row.raw.len() > 4 * 1024 * 1024)
        {
            break;
        }
        scanned.push(id.clone());
        let Some(row) = row else { continue };
        if row.id != *id {
            continue;
        }
        bytes += row.raw.len();
        rows.push(row);
    }
    Ok((rows, scanned))
}
