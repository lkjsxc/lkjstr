use super::*;
use lkjstr_protocol::{VerificationResult, verify_event};
impl Reads {
    /// Two active effects globally, one per account. Muting policy precedes memberships.
    pub fn next(&mut self, store: &Store, now: u64) -> Option<Job> {
        self.next_for(store, now, false)
    }
    /// Synchronous local policy does not wait behind unrelated external signer work.
    pub fn next_local_mute(&mut self, store: &Store, now: u64) -> Option<Job> {
        self.next_for(store, now, true)
    }
    fn next_for(&mut self, store: &Store, now: u64, local_only: bool) -> Option<Job> {
        let running = self.active();
        if !local_only && running.len() >= 2 {
            return None;
        }
        let busy: BTreeSet<_> = running.iter().map(|j| j.account.as_str()).collect();
        let mut candidates = self
            .wants
            .iter()
            .filter(|d| !local_only || d.client == super::policy::POLICY_CLIENT)
            .flat_map(|d| d.events.iter().map(move |id| (d.clone(), id.clone())))
            .collect::<Vec<_>>();
        candidates.sort_by_key(|(d, id)| {
            (
                store.get(id).is_none_or(|e| e.kind != 10000),
                d.account <= self.last_account,
                d.account.clone(),
                id.clone(),
                d.client,
                d.sub.clone(),
            )
        });
        for (d, id) in candidates {
            if (!local_only && busy.contains(d.account.as_str()))
                || self.failures.contains_key(&d.account)
            {
                continue;
            }
            let Some((access, epoch)) = self.access.get(&d.account) else {
                continue;
            };
            if access.error.is_some() || (!access.local && !d.external) {
                continue;
            }
            let epoch = *epoch;
            if !self.records.contains_key(&id) {
                if self.records.len() == MAX_RECORDS {
                    continue;
                }
                let Some(event) = store.get(&id) else {
                    continue;
                };
                let inspected = inspect(&event, &d.account);
                let (format, phase) = match inspected {
                    Ok(Some(format)) => (Some(format), Phase::Pending),
                    Ok(None) => (None, Phase::Ready),
                    Err(code) => (None, Phase::Failed(code)),
                };
                self.records.insert(
                    id.clone(),
                    Record {
                        account: d.account.clone(),
                        epoch,
                        format,
                        phase,
                        bytes: 0,
                    },
                );
                self.changed();
            }
            let Some(record) = self.records.get(&id) else {
                continue;
            };
            if !matches!(record.phase, Phase::Pending) {
                continue;
            }
            let Some(format) = record.format else {
                continue;
            };
            if self.unsupported.contains(&(d.account.clone(), format)) {
                continue;
            }
            let job = Job {
                token: self.serial()?,
                client: d.client,
                sub: d.sub,
                account: d.account.clone(),
                epoch,
                event: id.clone(),
                format,
                deadline: now.saturating_add(90_000),
            };
            self.records.get_mut(&id)?.phase = Phase::Running(job.clone());
            self.last_account = d.account;
            self.changed();
            return Some(job);
        }
        None
    }
}
fn inspect(
    event: &lkjstr_protocol::NostrEvent,
    account: &str,
) -> Result<Option<Format>, &'static str> {
    if event.pubkey != account || !matches!(event.kind, 10000 | 10003 | 30000) {
        return Err("rejected");
    }
    if event.kind == 30000 {
        let identifiers: Vec<_> = event
            .tags
            .iter()
            .filter(|t| t.first().is_some_and(|k| k == "d"))
            .collect();
        if identifiers.len() != 1 || identifiers[0].len() < 2 {
            return Err("rejected");
        }
    }
    if !matches!(verify_event(event), VerificationResult::Ok(_)) {
        return Err("rejected");
    }
    lkjstr_nips::list_read::format(&event.content).map_err(|error| match error {
        lkjstr_nips::Error::Size => "too-large",
        lkjstr_nips::Error::Version => "unsupported",
        _ => "rejected",
    })
}
