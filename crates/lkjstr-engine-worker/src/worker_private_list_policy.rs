//! Cache local mute policy before publishing compatible per-account unread counts.
use super::*;
pub(super) fn refresh(h: &mut Host) {
    if !h.loaded || h.stopped {
        return;
    }
    sync(h);
    let mut changed = false;
    for _ in 0..32 {
        let at = h.time();
        let Some(job) = h.engine.private_reads.next_local_mute(&h.engine.store, at) else {
            break;
        };
        // Local policy jobs never reach an external crypto bridge or borrow a client lease.
        let result = (|| {
            let local = h
                .accounts
                .entries
                .iter()
                .any(|a| a.pubkey == job.account && a.signer == "local");
            if !local {
                return Err("signer-missing");
            }
            let event = h.engine.store.get(&job.event).ok_or("not-found")?;
            h.accounts
                .crypt(
                    &job.account,
                    &job.account,
                    job.format.operation(),
                    &event.content,
                    &crate::browser::random_bytes::<32>()?,
                )?
                .ok_or("signer-missing")
        })();
        let finished = h.time();
        if let Some(tags) =
            h.engine
                .private_reads
                .finish(&h.engine.store, &job, result, finished, false)
        {
            h.engine.private_lists.insert(job.event, tags);
            changed = true;
        }
    }
    if h.private_lists.revision != h.engine.private_reads.revision {
        h.private_lists.revision = h.engine.private_reads.revision;
        h.account_revision = u64::MAX;
    }
    if changed {
        private_cache::revoke(h, true);
    }
}
