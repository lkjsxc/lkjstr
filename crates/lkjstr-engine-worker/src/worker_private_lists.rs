//! Bounded private-list effects; no decrypted tags enter the public event store.
use super::*;
use lkjstr_core::engine::{
    dm::signers::Lease,
    private_lists::{Access, Job},
    wire::{Input as I, Output as W, Session, actions::Action as A},
};
use std::collections::BTreeSet;
#[path = "worker_private_list_effect.rs"]
mod effect;
#[path = "worker_private_list_policy.rs"]
mod policy;
pub(super) fn local_policy(h: &mut Host) {
    policy::refresh(h);
}
#[derive(Default)]
pub(super) struct Book {
    revision: u64,
    flights: BTreeMap<u64, (Job, Option<Lease>)>, // at most two admitted list reads
}
pub(super) fn check(h: &Host, job: &Job) -> Result<(), &'static str> {
    if h.stopped || !h.sessions.contains_key(&job.client) {
        return Err("offline");
    }
    h.accounts.require_signer(&job.account)?;
    if h.engine.private_reads.current(job, h.time()) {
        Ok(())
    } else {
        Err("offline")
    }
}
pub(super) fn bind(h: &mut Host, job: &Job, lease: Lease) -> Result<(), &'static str> {
    check(h, job)?;
    let flight = h
        .private_lists
        .flights
        .get_mut(&job.token)
        .ok_or("offline")?;
    flight.1 = Some(lease);
    Ok(())
}
/// Called at input, account commit, expiry and each pump, before another private effect.
pub(super) fn sync(h: &mut Host) {
    let available = if h.stopped {
        BTreeMap::new()
    } else {
        h.accounts
            .entries
            .iter()
            .map(|a| {
                (
                    a.pubkey.clone(),
                    Access {
                        authority: a.authority(),
                        local: a.signer == "local",
                        error: h.accounts.require_signer(&a.pubkey).err(),
                    },
                )
            })
            .collect()
    };
    let local: BTreeSet<_> = available
        .iter()
        .filter(|(_, a)| a.local && a.error.is_none())
        .map(|(a, _)| a.clone())
        .collect();
    let demands = if h.stopped {
        vec![]
    } else {
        h.sessions
            .iter()
            .flat_map(|(id, s)| s.borrow().private_demands(*id, &h.engine, &local))
            .take(128)
            .collect()
    };
    let now = h.time();
    let engine = &mut h.engine;
    let removed = engine
        .private_reads
        .sync(&engine.store, available, demands, now);
    let mut changed = false;
    for id in removed {
        changed |= engine.private_lists.remove(&id).is_some();
    }
    let stale: Vec<_> = h
        .private_lists
        .flights
        .iter()
        .filter(|(_, (job, _))| !h.engine.private_reads.current(job, now))
        .map(|(token, _)| *token)
        .collect();
    for token in stale {
        if let Some((_, Some(lease))) = h.private_lists.flights.remove(&token) {
            direct_messages::signers::cancel_list(h, &lease);
        }
    }
    if h.private_lists.revision != h.engine.private_reads.revision {
        h.private_lists.revision = h.engine.private_reads.revision;
        h.account_revision = u64::MAX;
    }
    if changed && !h.stopped {
        private_cache::revoke(h, true);
    }
}
pub(super) fn input(h: &mut Host, id: u64, input: &I) -> bool {
    if let I::Act {
        req,
        action: A::ListsRetry { account },
    } = input
    {
        let result = match h.accounts.require_signer(account) {
            Err(code) => Session::failure(req.clone(), code),
            Ok(()) => {
                h.engine.private_reads.retry(account);
                let mut result = Session::failure(req.clone(), "internal");
                if let W::Result { ok, error, .. } = &mut result {
                    *ok = true;
                    *error = None;
                }
                result
            }
        };
        h.scope.direct(id, &result);
        return true;
    }
    false
}
pub(super) fn pump(host: &Rc<RefCell<Host>>) {
    {
        let mut h = host.borrow_mut();
        if !h.loaded || h.stopped {
            return;
        }
        sync(&mut h);
    }
    for _ in 0..2 {
        let next = {
            let mut h = host.borrow_mut();
            let at = h.time();
            let engine = &mut h.engine;
            engine
                .private_reads
                .next(&engine.store, at)
                .and_then(|job| {
                    let data = engine.store.get(&job.event)?.content.clone();
                    Some((job, data))
                })
        };
        let Some((job, data)) = next else {
            break;
        };
        host.borrow_mut()
            .private_lists
            .flights
            .insert(job.token, (job.clone(), None));
        effect::start(host, job, data);
    }
    let h = host.borrow();
    for (id, session) in &h.sessions {
        for out in session.borrow_mut().private_tick(&h.engine) {
            h.scope.direct(*id, &out);
        }
    }
}
