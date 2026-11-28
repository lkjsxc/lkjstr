//! Publication sockets have their own bounded slots and rotate across jobs.
use super::{publications::PUBLICATION_WAIT_MS, *};

const NOTE_CONNECT_WAIT_MS: u64 = 10_000;
const PUBLISH_SLOTS: usize = 12;

impl Publication {
    pub(super) fn pending_on(&self, url: &str, now: u64) -> bool {
        now < self.delivery_until()
            && self
                .route_deadlines
                .get(url)
                .is_some_and(|(connect, ack)| now < ack.unwrap_or(*connect))
            && self.deliveries.get(url).is_some_and(|s| s == "pending")
    }

    fn admit(&mut self, url: String, now: u64) {
        let wait = if self.event.kind == 1 {
            NOTE_CONNECT_WAIT_MS
        } else {
            PUBLICATION_WAIT_MS
        };
        let until = now.saturating_add(wait).min(self.delivery_until());
        self.route_deadlines.insert(url, (until, None));
    }

    pub(super) fn has_waiting(&self) -> bool {
        self.waiting.iter().any(|url| {
            !self.route_deadlines.contains_key(url)
                && self.deliveries.get(url).is_some_and(|s| s == "pending")
        })
    }

    fn next_queued(&mut self) -> Option<String> {
        while let Some(url) = self.waiting.pop_front() {
            if !self.route_deadlines.contains_key(&url)
                && self.deliveries.get(&url).is_some_and(|s| s == "pending")
            {
                return Some(url);
            }
        }
        None
    }
}

/// A post is a person waiting: each admitted route gets one connection attempt now, whatever
/// reconnect backoff earlier read failures left behind. A failed attempt backs off as before.
pub(super) fn reconnect_now(relays: &mut BTreeMap<String, Relay>, url: &str, now: u64) {
    if let Some(relay) = relays.get_mut(url)
        && !relay.online
        && !relay.connecting
    {
        relay.retry_at = relay.retry_at.min(now);
    }
}

impl Network {
    fn read_wanted(&self, url: &str) -> bool {
        self.requests
            .values()
            .any(|q| q.relay == url && !q.complete && (!q.speculative() || self.relays[url].online))
    }

    fn admit_existing_publication_routes(&mut self, now: u64) {
        let reusable: Vec<_> = self
            .relays
            .iter()
            .filter(|(url, relay)| {
                relay.online || relay.connecting || relay.publish_slot || self.read_wanted(url)
            })
            .map(|(url, _)| url.clone())
            .collect();
        for publication in self
            .publications
            .values_mut()
            .filter(|p| now < p.delivery_until())
        {
            for url in &reusable {
                if !publication.route_deadlines.contains_key(url)
                    && publication
                        .deliveries
                        .get(url)
                        .is_some_and(|s| s == "pending")
                {
                    publication.admit(url.clone(), now);
                    reconnect_now(&mut self.relays, url, now);
                }
            }
        }
    }

    fn admit_publication_routes(&mut self, now: u64) {
        self.admit_existing_publication_routes(now);
        let mut slots = PUBLISH_SLOTS.saturating_sub(
            self.relays
                .values()
                .filter(|relay| relay.publish_slot)
                .count(),
        );
        let mut jobs: Vec<_> = self
            .publications
            .iter()
            .filter(|(_, p)| now < p.delivery_until() && p.has_waiting())
            .map(|(id, _)| id.clone())
            .collect();
        if let Some(cursor) = &self.publish_cursor {
            let next = jobs.partition_point(|id| id <= cursor);
            jobs.rotate_left(next);
        }
        // Keep the first answer ahead of delivery that already resolved an action.
        jobs.sort_by_key(|id| self.publications[id].reported_success);
        while slots > 0 && !jobs.is_empty() {
            jobs.retain(|id| {
                if slots == 0 {
                    return true;
                }
                let Some(publication) = self.publications.get_mut(id) else {
                    return false;
                };
                let Some(url) = publication.next_queued() else {
                    return false;
                };
                let created = !self.relays.contains_key(&url);
                if created {
                    self.relays.insert(
                        url.clone(),
                        Relay {
                            publish_only: true,
                            retry_at: now,
                            max_reqs: 4,
                            max_limit: 200,
                            ..Default::default()
                        },
                    );
                }
                if let Some(relay) = self.relays.get_mut(&url).filter(|r| !r.publish_slot) {
                    relay.publish_slot = true;
                    slots -= 1;
                    self.publish_cursor = Some(id.clone());
                }
                publication.admit(url.clone(), now);
                reconnect_now(&mut self.relays, &url, now);
                let more = publication.has_waiting();
                if created {
                    self.apply_quality(&url, now);
                }
                more
            });
        }
        self.admit_existing_publication_routes(now);
    }

    pub(super) fn drive_connections(&mut self, now: u64) {
        let queued = self
            .publications
            .values()
            .any(|p| now < p.delivery_until() && p.has_waiting());
        let released: Vec<_> = self
            .relays
            .iter()
            .filter(|(url, relay)| {
                relay.publish_slot
                    && !self.publications.values().any(|p| p.pending_on(url, now))
                    && (queued || !relay.online || !self.delivery_connection_wanted(url, now))
            })
            .map(|(url, _)| url.clone())
            .collect();
        for url in released {
            let reading = self.read_wanted(&url);
            if let Some(relay) = self.relays.get_mut(&url) {
                relay.publish_slot = false;
                if !reading && (relay.online || relay.connecting) {
                    self.effects.push(Effect::Disconnect(url));
                    relay.auth.reset();
                    relay.online = false;
                    relay.connected_since = None;
                    relay.connecting = false;
                    relay.retry_at = now;
                }
            }
        }
        self.release_publication_relays();
        self.admit_configured(now);
        self.admit_publication_routes(now);
        let relays: Vec<_> = self.relays.keys().cloned().collect();
        for url in relays {
            let r = &self.relays[&url];
            let wanted = self.read_wanted(&url)
                || (r.online && self.delivery_connection_wanted(&url, now))
                || self.publications.values().any(|p| p.pending_on(&url, now));
            if !wanted {
                if r.online || r.connecting {
                    self.effects.push(Effect::Disconnect(url.clone()));
                    if let Some(r) = self.relays.get_mut(&url) {
                        r.auth.reset();
                        r.online = false;
                        r.connected_since = None;
                        r.connecting = false;
                        r.retry_at = now;
                    }
                }
                continue;
            }
            if (r.online && now.saturating_sub(r.last_rx) > 120000)
                || (r.connecting && now >= r.retry_at)
            {
                self.disconnected(&url, now);
            }
            if let Some(r) = self.relays.get_mut(&url)
                && !r.online
                && !r.connecting
                && now >= r.retry_at
            {
                r.connecting = true;
                r.retry_at = now + 15000;
                self.effects.push(Effect::Connect(url));
            }
        }
    }
}

#[cfg(test)]
#[path = "network_publish_slots_test.rs"]
mod tests;
