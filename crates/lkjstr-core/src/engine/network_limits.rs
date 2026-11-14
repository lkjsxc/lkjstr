//! NIP-11 constraints, observed failures and bounded usefulness statistics.
use super::network::*;
impl Network {
    pub fn relay_information(&mut self, relay: &str, json: &str) {
        let Ok(info) = lkjstr_nips::metadata::RelayInformation::parse(json, 65536) else {
            return;
        };
        if let Some(r) = self.relays.get_mut(relay) {
            if let Some(limit) = info
                .limitation
                .as_ref()
                .and_then(|l| l.get("max_subscriptions"))
                .and_then(|v| v.as_u64())
            {
                r.max_reqs = (limit as usize).clamp(1, 4);
            }
            if let Some(limit) = info
                .limitation
                .as_ref()
                .and_then(|l| l.get("max_limit"))
                .and_then(|v| v.as_u64())
            {
                r.max_limit = limit.clamp(1, 200);
            }
            r.nip11 = true;
        }
    }
}
impl Network {
    pub fn lookup_complete(&self, id: &str) -> bool {
        let matches: Vec<_> = self
            .requests
            .values()
            .filter(|r| {
                r.filter
                    .ids
                    .as_ref()
                    .is_some_and(|ids| ids.iter().any(|key| key == id))
            })
            .collect();
        !matches.is_empty() && matches.iter().all(|r| r.asked && (r.eose || r.complete))
    }
}
impl Network {
    pub fn request_progress(&self, sub: &str) -> (usize, usize) {
        let requests: Vec<_> = self
            .requests
            .values()
            .filter(|r| r.members.contains(sub))
            .collect();
        let asked = requests
            .iter()
            .filter(|r| r.asked)
            .map(|r| &r.relay)
            .collect::<std::collections::BTreeSet<_>>()
            .len();
        let answered = requests
            .iter()
            .filter(|r| r.asked && (r.eose || r.last_event.is_some()))
            .map(|r| &r.relay)
            .collect::<std::collections::BTreeSet<_>>()
            .len();
        (asked, answered)
    }
}
