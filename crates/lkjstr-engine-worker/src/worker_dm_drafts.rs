//! Private draft jobs keep keys and unsaved text in Host-owned, revocable slots.
use super::*;
use crate::browser::idb_drafts;
use lkjstr_core::engine::{accounts::secret::SecretText, dm::drafts as policy, upload::Deadline};
use lkjstr_nips::nip44::ConversationKey;
use std::collections::BTreeMap;
#[path = "worker_dm_draft_job.rs"]
mod job;
#[path = "worker_dm_draft_key.rs"]
mod key;
#[path = "worker_dm_draft_storage.rs"]
mod storage;

enum Operation {
    Load,
    Save(policy::State),
    Clear,
}
struct Job {
    client: u64,
    req: String,
    account: String,
    tab: String,
    epoch: u64,
    deadline: Deadline,
    operation: Operation,
    expected: Option<String>,
    running: bool,
    baseline: Option<Option<String>>,
}
struct Cached {
    epoch: u64,
    generation: String,
    wrapped_seed: Option<String>,
    key: ConversationKey,
}
#[derive(Default)]
pub(super) struct Book {
    jobs: BTreeMap<u64, Job>, // <=4 jobs; saved plaintext is erased when removed
    keys: BTreeMap<String, Cached>, // <=32 accounts; keys zeroize on drop
    transactions: BTreeMap<u64, web_sys::IdbTransaction>, // <=4; aborted on revocation
    serial: u64,
}
pub(super) fn input(h: &mut Host, client: u64, message: &I) -> bool {
    use lkjstr_core::engine::wire::actions::Action as A;
    let I::Act { req, action } = message else {
        return false;
    };
    let (account, tab, operation, expected) = match action {
        A::DmDraftLoad { account, tab } => (account, tab, Operation::Load, None),
        A::DmDraftSave {
            account,
            tab,
            state,
            expected,
        } => (
            account,
            tab,
            Operation::Save(state.clone()),
            expected.clone(),
        ),
        A::DmDraftClear {
            account,
            tab,
            expected,
        } => (account, tab, Operation::Clear, expected.clone()),
        _ => return false,
    };
    lifetime::sync(h);
    if h.dm
        .drafts
        .jobs
        .values()
        .any(|j| j.client == client && j.req == *req)
    {
        return true;
    }
    let result = (|| {
        policy::tab_key(tab)?;
        if expected
            .as_deref()
            .is_some_and(|value| !lkjstr_protocol::is_event_id(value))
        {
            return Err("rejected");
        }
        if let Operation::Save(state) = &operation {
            policy::validate(state)?;
        }
        let epoch = lifetime::lease(h, client, account)?;
        if h.dm.drafts.jobs.len() >= 4 {
            return Err("too-large");
        }
        let serial = h.dm.drafts.serial.checked_add(1).ok_or("too-large")?;
        h.dm.drafts.serial = serial;
        h.dm.drafts.jobs.insert(
            serial,
            Job {
                client,
                req: req.clone(),
                account: account.clone(),
                tab: tab.clone(),
                epoch,
                deadline: Deadline::new(uploads::clock()),
                operation,
                expected,
                running: false,
                baseline: None,
            },
        );
        Ok(())
    })();
    if let Err(code) = result {
        h.scope.direct(client, &Session::failure(req.clone(), code));
    }
    true
}
pub(super) fn sync(h: &mut Host) {
    let expired: Vec<_> =
        h.dm.drafts
            .jobs
            .keys()
            .copied()
            .filter_map(|id| check(h, id).err().map(|code| (id, code)))
            .collect();
    for (id, code) in expired {
        if let Some(tx) = h.dm.drafts.transactions.remove(&id) {
            let _ = tx.abort();
        }
        if let Some(job) = h.dm.drafts.jobs.remove(&id)
            && !h.stopped
            && h.sessions.contains_key(&job.client)
        {
            h.scope.direct(job.client, &Session::failure(job.req, code));
        }
    }
    let revoked: Vec<_> =
        h.dm.drafts
            .keys
            .iter()
            .filter(|(a, cached)| {
                h.stopped
                    || h.sessions.is_empty()
                    || h.accounts.require_signer(a).is_err()
                    || h.dm
                        .access
                        .get(*a)
                        .is_none_or(|(ok, epoch)| !*ok || *epoch != cached.epoch)
            })
            .map(|(a, _)| a.clone())
            .collect();
    for account in revoked {
        h.dm.drafts.keys.remove(&account);
    }
}
pub(super) fn pump(host: &Rc<RefCell<Host>>) {
    let work = {
        let mut h = host.borrow_mut();
        sync(&mut h);
        let mut busy: BTreeSet<_> =
            h.dm.drafts
                .jobs
                .values()
                .filter(|j| j.running)
                .map(|j| j.account.clone())
                .collect();
        let mut work = Vec::new();
        for (id, task) in &mut h.dm.drafts.jobs {
            if !task.running && busy.insert(task.account.clone()) {
                task.running = true;
                work.push(*id);
            }
        }
        work
    };
    for id in work {
        let host = host.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let outcome = job::run(&host, id).await;
            let mut h = host.borrow_mut();
            let outcome = check(&h, id).and(outcome);
            let Some(job) = h.dm.drafts.jobs.remove(&id) else {
                return;
            };
            h.dm.drafts.transactions.remove(&id);
            if h.stopped || !h.sessions.contains_key(&job.client) {
                return;
            }
            match outcome {
                Ok(state) => {
                    let mut output = result(job.req, None, None);
                    if let W::Result {
                        dm_draft,
                        dm_draft_revision,
                        ..
                    } = &mut output
                    {
                        *dm_draft = state.state.map(Box::new);
                        *dm_draft_revision = Some(state.revision);
                    }
                    h.scope.direct(job.client, &output);
                }
                Err(code) => h.scope.direct(job.client, &Session::failure(job.req, code)),
            }
        });
    }
}
fn check(h: &Host, id: u64) -> Result<(), &'static str> {
    let task = h.dm.drafts.jobs.get(&id).ok_or("signer-missing")?;
    lifetime::check(h, task.client, &task.account, task.epoch)?;
    task.deadline
        .wait(uploads::clock(), 1)
        .map_err(|_| "internal")?;
    Ok(())
}

#[cfg(feature = "harness")]
pub(super) fn stop_probe(h: &Host) -> (usize, usize, usize) {
    (
        h.dm.drafts.jobs.len(),
        h.dm.drafts.keys.len(),
        h.dm.drafts.transactions.len(),
    )
}
