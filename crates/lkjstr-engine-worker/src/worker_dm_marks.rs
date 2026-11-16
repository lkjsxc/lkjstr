//! Read marks commit before success; decrypted bodies never reach IndexedDB.
use super::*;
pub(super) fn load(host: &Rc<RefCell<Host>>) {
    let db = {
        let mut h = host.borrow_mut();
        if h.dm.marks_started {
            return;
        }
        let Some(db) = h.db.clone() else {
            h.dm.marks_started = true;
            h.dm.marks_error = Some("internal");
            return;
        };
        h.dm.marks_started = true;
        db
    };
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        let raw = idb::kv_get(&db, "dm-seen-v1").await;
        if let Some(host) = weak.upgrade() {
            let mut h = host.borrow_mut();
            if h.stopped {
                return;
            }
            let outcome = match raw {
                Ok(Some(raw)) => h.dm.inbox.restore_marks(&raw),
                Ok(None) => Ok(()),
                Err(_) => Err("internal"),
            };
            h.dm.marks_error = outcome.err();
            h.dm.marks_ready = h.dm.marks_error.is_none();
            h.dm.next_emit = 0;
        }
    });
}
pub(super) async fn save(
    host: &Rc<RefCell<Host>>,
    client: u64,
    account: &str,
    epoch: u64,
    conversation: &str,
) -> Result<(), &'static str> {
    let (db, raw, mark) = {
        let mut h = host.borrow_mut();
        lifetime::check(&h, client, account, epoch)?;
        let db = h.db.clone().ok_or("internal")?;
        let key = format!("{account}:{conversation}");
        let old = h.dm.inbox.marks.get(&key).cloned();
        h.dm.inbox.seen(account, conversation)?;
        let mark = h.dm.inbox.marks.get(&key).cloned().ok_or("internal")?;
        let raw = serde_json::to_string(&h.dm.inbox.marks).map_err(|_| "internal");
        if let Some(old) = old {
            h.dm.inbox.marks.insert(key, old);
        } else {
            h.dm.inbox.marks.remove(&key);
        }
        let raw = raw?;
        if raw.len() > 4 * 1024 * 1024 {
            return Err("too-large");
        }
        (db, raw, mark)
    };
    idb::kv_put(&db, "dm-seen-v1", &raw)
        .await
        .map_err(|_| "internal")?;
    let mut h = host.borrow_mut();
    if h.stopped {
        return Err("offline");
    }
    lifetime::check(&h, client, account, epoch)?;
    h.dm.inbox
        .marks
        .insert(format!("{account}:{conversation}"), mark);
    h.dm.inbox.revision = h.dm.inbox.revision.wrapping_add(1);
    Ok(())
}
