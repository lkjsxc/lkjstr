//! Saved-account unread policy needs local mute lists even without a visible feed.
use super::*;
pub(super) const POLICY_CLIENT: u64 = u64::MAX;
impl Reads {
    pub(super) fn local_demands(&self, store: &Store) -> Vec<Demand> {
        self.access
            .iter()
            .filter(|(_, (a, _))| a.local && a.error.is_none())
            .filter_map(|(account, _)| {
                let event = store
                    .replaceable(account, 10000)
                    .filter(|e| !e.content.is_empty())?;
                Some(Demand {
                    client: POLICY_CLIENT,
                    sub: "local-mute-policy".into(),
                    account: account.clone(),
                    events: vec![event.id.clone()],
                    external: false,
                })
            })
            .collect()
    }
    /// Evidence for the observed encrypted mute dependency of the compatible unread count.
    pub fn policy_status(&self, store: &Store, account: &str) -> Status {
        let ids: Vec<_> = store
            .replaceable(account, 10000)
            .filter(|e| !e.content.is_empty())
            .map(|e| e.id.clone())
            .into_iter()
            .collect();
        let mut status = self.status(account, &ids);
        if ids.is_empty() {
            return status;
        }
        if let Some(code) = self
            .access
            .get(account)
            .map_or(Some("signer-missing"), |(a, _)| a.error)
        {
            status.phase = if matches!(code, "read-only" | "unsupported") {
                "unsupported"
            } else {
                "unknown"
            };
            if status.phase == "unknown" {
                status.failed = 0;
                status.pending = ids.len();
            }
        } else if status.pending > 0
            && !self
                .wants
                .iter()
                .any(|d| d.account == account && d.events.contains(&ids[0]))
        {
            status.phase = "unknown";
        }
        status
    }
}
