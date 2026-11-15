//! Configured transports: 24 active routes and 64 remembered URLs.
use super::*;
impl Network {
    pub fn configure(&mut self, urls: Vec<String>, now: u64) {
        self.relay_order = urls
            .iter()
            .filter_map(|u| normalize_relay_url(u))
            .take(24)
            .collect();
        let urls: BTreeSet<_> = urls
            .iter()
            .filter_map(|u| normalize_relay_url(u))
            .take(24)
            .collect();
        let removed: Vec<_> = self
            .relays
            .keys()
            .filter(|u| !urls.contains(*u))
            .cloned()
            .collect();
        for r in removed {
            self.effects.push(Effect::Disconnect(r.clone()));
            self.relays.remove(&r);
        }
        for url in urls.iter().cloned() {
            // Keep 64 known URLs across account/hint changes; active routes win.
            if !self.known.contains_key(&url) && self.known.len() >= 64 {
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
            if !self.relays.contains_key(&url) {
                self.effects.push(Effect::Inspect(url.clone()));
            }
            self.relays.entry(url).or_insert(Relay {
                retry_at: now,
                max_reqs: 4,
                max_limit: 200,
                ..Default::default()
            });
        }
    }
}
