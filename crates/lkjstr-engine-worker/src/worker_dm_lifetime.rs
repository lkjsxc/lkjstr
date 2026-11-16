//! Accessibility leases prevent a completed signer call from reviving a locked session.
use super::*;
pub(super) fn identity(task: &Task) -> (u64, &str, &str) {
    match task {
        Task::Send {
            client,
            account,
            req,
            ..
        }
        | Task::Relays {
            client,
            account,
            req,
            ..
        }
        | Task::Seen {
            client,
            account,
            req,
            ..
        } => (*client, account, req),
    }
}
pub(super) fn sync(h: &mut Host) {
    let saved: BTreeSet<_> = h
        .accounts
        .entries
        .iter()
        .map(|a| a.pubkey.clone())
        .collect();
    let available: BTreeSet<_> = if h.stopped {
        BTreeSet::new()
    } else {
        saved
            .iter()
            .filter(|a| h.accounts.require_signer(a).is_ok())
            .cloned()
            .collect()
    };
    let replaced: BTreeSet<_> = h
        .accounts
        .entries
        .iter()
        .filter(|a| {
            h.dm.authority
                .get(&a.pubkey)
                .is_some_and(|n| *n != a.authority())
        })
        .map(|a| a.pubkey.clone())
        .collect();
    let revoked: BTreeSet<_> =
        h.dm.access
            .iter()
            .filter(|(a, (ok, _))| *ok && (!available.contains(*a) || replaced.contains(*a)))
            .map(|(a, _)| a.clone())
            .collect();
    let mut changed = !revoked.is_empty();
    h.dm.access.retain(|a, _| saved.contains(a));
    h.dm.authority = h
        .accounts
        .entries
        .iter()
        .map(|a| (a.pubkey.clone(), a.authority()))
        .collect();
    for account in &saved {
        let usable = available.contains(account);
        if h.dm
            .access
            .get(account)
            .is_none_or(|(was, _)| *was != usable)
            || replaced.contains(account)
        {
            h.dm.serial = h.dm.serial.wrapping_add(1);
            let epoch = h.dm.serial;
            h.dm.access.insert(account.clone(), (usable, epoch));
            if usable
                && h.dm
                    .errors
                    .get(account)
                    .is_some_and(|e| e == "signer-missing")
            {
                h.dm.errors.remove(account);
            }
            changed = true;
        }
    }
    if !changed {
        return;
    }
    h.dm.last_scan = u64::MAX;
    h.dm.next_emit = 0;
    h.dm.inbox.retain_accounts(&saved);
    let retained: BTreeSet<_> = available.difference(&revoked).cloned().collect();
    h.dm.inbox.retain_messages(&retained);
    h.dm.queue.retain(|(a, _)| retained.contains(a));
    h.dm.attempted.retain(|(a, _)| retained.contains(a));
    for account in &revoked {
        delivery::revoke(h, account);
    }
    let tasks = std::mem::take(&mut h.dm.tasks);
    for (task, epoch) in tasks {
        let (client, account, req) = identity(&task);
        if revoked.contains(account) {
            if !h.stopped {
                h.scope
                    .direct(client, &Session::failure(req.into(), "signer-missing"));
            }
        } else {
            h.dm.tasks.push((task, epoch));
        }
    }
}
pub(super) fn lease(h: &Host, client: u64, account: &str) -> Result<u64, &'static str> {
    let epoch =
        h.dm.access
            .get(account)
            .map(|(_, n)| *n)
            .ok_or("signer-missing")?;
    check(h, client, account, epoch)?;
    Ok(epoch)
}
pub(super) fn check(h: &Host, client: u64, account: &str, epoch: u64) -> Result<(), &'static str> {
    if h.stopped || !h.sessions.contains_key(&client) {
        return Err("offline");
    }
    h.accounts.require_signer(account)?;
    if h.dm
        .access
        .get(account)
        .is_none_or(|(ok, n)| !*ok || *n != epoch)
    {
        return Err("signer-missing");
    }
    Ok(())
}
