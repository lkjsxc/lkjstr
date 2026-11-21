//! Configured transports: 24 active routes and 64 remembered URLs.
use super::*;
impl Network {
    pub fn configure(&mut self, urls: Vec<String>, now: u64) {
        self.remember_quality(now);
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
            if !self.admit_reader(&url, now) {
                self.deferred_relays.insert(url);
            } else if self.deferred_relays.remove(&url) {
                self.profiles_changed = true;
            }
        }
    }

    pub(super) fn has_reader(&self, url: &str) -> bool {
        self.relays.get(url).is_some_and(|r| !r.publish_only)
    }

    pub(super) fn admit_reader(&mut self, url: &str, now: u64) -> bool {
        if self.has_reader(url) {
            return true;
        }
        if self.relays.values().filter(|r| !r.publish_only).count() >= 64 {
            return false;
        }
        self.effects.push(Effect::Inspect(url.to_owned()));
        if let Some(relay) = self.relays.get_mut(url) {
            relay.publish_only = false;
        } else {
            self.relays.insert(
                url.to_owned(),
                Relay {
                    retry_at: now,
                    max_reqs: 4,
                    max_limit: 200,
                    ..Default::default()
                },
            );
            self.apply_quality(url, now);
        }
        true
    }
}
