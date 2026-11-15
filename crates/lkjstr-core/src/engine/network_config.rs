//! Configured transports: 24 active routes and 64 remembered URLs.
use super::*;
impl Network {
    pub fn configure(&mut self, urls: Vec<String>, now: u64) {
        let mut seen = BTreeSet::new();
        self.relay_order = urls
            .iter()
            .filter_map(|u| normalize_relay_url(u))
            .filter(|u| seen.insert(u.clone()))
            .take(24)
            .collect();
        let urls: BTreeSet<_> = self.relay_order.iter().cloned().collect();
        self.deferred_relays.clear();
        let removed: Vec<_> = self
            .relays
            .keys()
            .filter(|u| {
                !urls.contains(*u)
                    && !self
                        .publications
                        .values()
                        .any(|p| p.deliveries.get(*u).is_some_and(|s| s == "pending"))
            })
            .cloned()
            .collect();
        for r in removed {
            self.effects.push(Effect::Disconnect(r.clone()));
            self.relays.remove(&r);
        }
        for url in &urls {
            // Keep 64 known URLs across account/hint changes; active routes win.
            if !self.known.contains_key(url) && self.known.len() >= 64 {
                let old = self.known.keys().find(|u| !urls.contains(*u)).cloned();
                if let Some(old) = old {
                    self.known.remove(&old);
                }
            }
            self.known
                .entry(url.clone())
                .or_insert(crate::engine::wire::RelayConfig {
                    url: url.clone(),
                    read: true,
                    write: true,
                    search: true,
                });
        }
        self.admit_configured(now);
    }
    pub(super) fn admit_configured(&mut self, now: u64) {
        for url in self.relay_order.clone() {
            if self.relays.contains_key(&url) {
                self.deferred_relays.remove(&url);
                continue;
            }
            if self.relays.len() >= 64 {
                self.deferred_relays.insert(url);
                continue;
            }
            self.effects.push(Effect::Inspect(url.clone()));
            self.relays.insert(
                url.clone(),
                Relay {
                    retry_at: now,
                    max_reqs: 4,
                    max_limit: 200,
                    ..Default::default()
                },
            );
            if self.deferred_relays.remove(&url) {
                self.profiles_changed = true;
            }
        }
    }
}
