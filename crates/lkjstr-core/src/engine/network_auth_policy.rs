//! Authorization follows current device identity and current work, never a challenge alone.
use super::*;
pub(super) fn request_needs(filter: &NostrFilter, account: &str, active: Option<&str>) -> bool {
    if filter
        .kinds
        .as_ref()
        .is_some_and(|ks| ks.iter().any(|k| matches!(k, 4 | 1059)))
    {
        filter
            .tags
            .get("p")
            .is_some_and(|ps| ps.iter().any(|p| p == account))
            || filter
                .authors
                .as_ref()
                .is_some_and(|ps| ps.iter().any(|p| p == account))
    } else {
        active == Some(account)
    }
}
impl Network {
    /// The host refreshes this immediately after every account commit, before replies.
    /// Only currently usable signers belong here; at most 32 public identifiers.
    pub fn set_auth_accounts(&mut self, accounts: &[String], active: Option<&str>, now: u64) {
        self.auth_signers = accounts
            .iter()
            .take(32)
            .filter(|a| lkjstr_protocol::is_pubkey(a))
            .cloned()
            .collect();
        self.auth_active = active
            .filter(|a| lkjstr_protocol::is_pubkey(a))
            .map(str::to_owned);
        for relay in self.relays.values_mut() {
            relay.auth.tried.retain(|a| self.auth_signers.contains(a));
        }
        let stale = self
            .relays
            .values()
            .filter_map(|r| r.auth.pending.as_ref())
            .filter(|(job, _)| !self.auth_needed(&job.relay, &job.event.pubkey, now))
            .map(|(job, _)| job.clone())
            .collect::<Vec<_>>();
        for job in stale {
            self.auth_cancel(&job);
        }
    }
    pub(super) fn auth_needed(&self, relay: &str, account: &str, now: u64) -> bool {
        if !self.auth_signers.contains(account) {
            return false;
        }
        let Some(r) = self.relays.get(relay).filter(|r| r.online) else {
            return false;
        };
        r.auth.blocked.iter().any(|id| {
            self.requests.get(id).is_some_and(|q| {
                !q.complete
                    && now < q.deadline
                    && request_needs(&q.filter, account, self.auth_active.as_deref())
            })
        }) || r.auth.writes.iter().any(|id| {
            self.publications.get(id).is_some_and(|p| {
                p.auth_account == account
                    && now < p.deadline
                    && p.deliveries.get(relay).is_some_and(|s| s == "pending")
            })
        })
    }
    /// A revoked identity or removed demand is cancellation, not failure of other work.
    pub(super) fn auth_cancel(&mut self, job: &AuthRequest) {
        if let Some(r) = self.relays.get_mut(&job.relay)
            && r.auth
                .pending
                .as_ref()
                .is_some_and(|(p, _)| p.generation == job.generation)
        {
            r.auth.pending = None;
            r.auth.tried.remove(&job.event.pubkey);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn connection_attempt_history_follows_device_account_replacement() {
        let mut network = Network::default();
        network
            .relays
            .insert("wss://auth.test/".into(), Relay::default());
        for index in 0..128 {
            let account = format!("{index:064x}");
            let relay = network
                .relays
                .get_mut("wss://auth.test/")
                .unwrap_or_else(|| unreachable!());
            relay.auth.tried.insert(account.clone());
            network.set_auth_accounts(std::slice::from_ref(&account), None, 0);
            assert_eq!(network.relays["wss://auth.test/"].auth.tried.len(), 1);
        }
        network.set_auth_accounts(&[], None, 0);
        assert!(network.relays["wss://auth.test/"].auth.tried.is_empty());
    }
}
