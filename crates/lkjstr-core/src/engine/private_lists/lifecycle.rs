use super::*;
impl Reads {
    /// Retire revoked/replaced entries before the host can emit an account acknowledgement.
    pub fn sync(
        &mut self,
        store: &Store,
        available: BTreeMap<String, Access>,
        demands: Vec<Demand>,
        now: u64,
    ) -> Vec<String> {
        let mut changed = false;
        let kept: BTreeSet<_> = available.keys().take(32).cloned().collect();
        self.access.retain(|account, _| kept.contains(account));
        for (account, access) in available.into_iter().take(32) {
            if self
                .access
                .get(&account)
                .is_none_or(|(old, _)| old != &access)
                && let Some(epoch) = self.serial()
            {
                self.access.insert(account.clone(), (access, epoch));
                self.failures.remove(&account);
                self.unsupported.retain(|(a, _)| a != &account);
                changed = true;
            }
        }
        self.failures.retain(|a, _| self.access.contains_key(a));
        self.unsupported
            .retain(|(a, _)| self.access.contains_key(a));
        let mut wants: Vec<_> = demands
            .into_iter()
            .take(128)
            .filter_map(|mut d| {
                let (a, _) = self.access.get(&d.account)?;
                if a.error.is_some() || (!a.local && !d.external) || d.sub.len() > 256 {
                    return None;
                }
                d.events.truncate(3);
                d.events.retain(|id| {
                    store.get(id).is_some_and(|e| {
                        e.pubkey == d.account
                            && matches!(e.kind, 10000 | 10003 | 30000)
                            && !e.content.is_empty()
                    })
                });
                Some(d)
            })
            .collect();
        wants.extend(self.local_demands(store));
        changed |= wants != self.wants;
        self.wants = wants;
        let removed: Vec<_> = self
            .records
            .iter()
            .filter(|(id, r)| {
                self.access
                    .get(&r.account)
                    .is_none_or(|(a, epoch)| a.error.is_some() || *epoch != r.epoch)
                    || !current(store, id)
            })
            .map(|(id, _)| id.clone())
            .collect();
        for id in &removed {
            self.records.remove(id);
            changed = true;
        }
        let stale: Vec<_> = self
            .active()
            .into_iter()
            .filter(|job| !self.current(job, now))
            .collect();
        for job in stale {
            if let Some(record) = self.records.get_mut(&job.event) {
                record.phase = if now >= job.deadline {
                    Phase::Failed("offline")
                } else {
                    Phase::Pending
                };
                changed = true;
            }
        }
        if changed {
            self.changed();
        }
        removed
    }
    pub fn clear(&mut self) -> Vec<String> {
        let ids = self.records.keys().cloned().collect();
        self.records.clear();
        self.access.clear();
        self.wants.clear();
        self.failures.clear();
        self.unsupported.clear();
        self.changed();
        ids
    }
}
