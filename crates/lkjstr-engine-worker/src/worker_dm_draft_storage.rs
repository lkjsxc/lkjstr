//! Storage waits carry ciphertext/public identifiers, never a key or decrypted catalog.
use super::*;
pub(super) async fn access(
    host: &Rc<RefCell<Host>>,
    id: u64,
    change: idb_drafts::Change,
) -> Result<idb_drafts::Reply, &'static str> {
    let (db, account, ms) = {
        let h = host.borrow();
        check(&h, id)?;
        let task = h.dm.drafts.jobs.get(&id).ok_or("signer-missing")?;
        (
            h.db.clone().ok_or("internal")?,
            task.account.clone(),
            task.deadline
                .wait(uploads::clock(), 15_000)
                .map_err(|_| "internal")?,
        )
    };
    let weak = Rc::downgrade(host);
    let live: idb_drafts::Live = Rc::new(move || {
        let host = weak.upgrade().ok_or("offline")?;
        check(&host.borrow(), id)
    });
    let weak = Rc::downgrade(host);
    let track: idb_drafts::Track = Rc::new(move |tx| {
        if let Some(host) = weak.upgrade() {
            let mut h = host.borrow_mut();
            if let Some(tx) = tx {
                if h.dm.drafts.jobs.contains_key(&id) {
                    h.dm.drafts.transactions.insert(id, tx);
                } else {
                    let _ = tx.abort();
                }
            } else {
                h.dm.drafts.transactions.remove(&id);
            }
        } else if let Some(tx) = tx {
            let _ = tx.abort();
        }
    });
    let result = idb_drafts::run(&db, &account, change, ms, live, track).await;
    check(&host.borrow(), id)?;
    result
}
pub(super) async fn read(
    host: &Rc<RefCell<Host>>,
    id: u64,
) -> Result<idb_drafts::Slot, &'static str> {
    let fresh_generation = lkjstr_nips::hex(&crate::browser::random_bytes::<16>()?);
    match access(host, id, idb_drafts::Change::Read { fresh_generation }).await? {
        idb_drafts::Reply::Read(slot) => Ok(slot),
        _ => Err("internal"),
    }
}
