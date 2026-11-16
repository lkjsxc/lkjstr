use super::super::{Failure, Phase, Result};
use super::{Discovery, Entry, MAX_HTTP, MAX_PROVIDERS, Providers, Work};
use crate::store::Store;
use std::collections::BTreeSet;

impl Providers {
    /// Current visible quotes/receipts and explicit invoice jobs own these wants.
    /// Removing a want cancels its fetch; bounded ready evidence may stay warm.
    pub fn sync(&mut self, store: &Store, recipients: &[String], now: u64) -> Result<Work> {
        self.sync_for(store, recipients, &BTreeSet::new(), now)
    }
    /// Explicit jobs take the next free slot; existing HTTP is not preempted.
    pub fn sync_for(
        &mut self,
        store: &Store,
        recipients: &[String],
        urgent: &BTreeSet<String>,
        now: u64,
    ) -> Result<Work> {
        let mut wanted = BTreeSet::new();
        for recipient in recipients {
            wanted.insert(recipient.clone());
            if wanted.len() > MAX_PROVIDERS {
                return Err(Failure::TooLarge);
            }
        }
        let mut work = Work::default();
        for (key, entry) in &mut self.entries {
            if !wanted.contains(key)
                && let Some((token, _)) = entry.inflight.take()
            {
                work.cancel.push(token);
                self.revision = self.revision.saturating_add(1);
            }
        }
        self.entries.retain(|key, entry| {
            wanted.contains(key) || entry.provider.as_ref().is_some_and(|p| now < p.expires_at)
        });
        self.wanted = wanted;
        for recipient in &self.wanted {
            if !self.entries.contains_key(recipient) && self.entries.len() == MAX_PROVIDERS {
                let oldest = self
                    .entries
                    .iter()
                    .filter(|(key, _)| !self.wanted.contains(*key))
                    .min_by_key(|(_, e)| e.last_used)
                    .map(|(key, _)| key.clone());
                if let Some(oldest) = oldest {
                    self.entries.remove(&oldest);
                }
            }
            let added = !self.entries.contains_key(recipient);
            let profile = store.replaceable(recipient, 0).map(|p| p.id.clone());
            let entry = self
                .entries
                .entry(recipient.clone())
                .or_insert_with(|| Entry::new(store, recipient, now));
            entry.last_used = now;
            if added {
                self.revision = self.revision.saturating_add(1);
            }
            if entry.profile != profile {
                if let Some((token, _)) = entry.inflight {
                    work.cancel.push(token);
                }
                entry.refresh(store, recipient, now);
                self.revision = self.revision.saturating_add(1);
            }
            if entry.inflight.is_some_and(|(_, deadline)| now >= deadline) {
                if let Some((token, _)) = entry.inflight.take() {
                    work.cancel.push(token);
                }
                entry.phase = Phase::Failed;
                entry.error = Some(Failure::Network);
                entry.retry_at = now.saturating_add(super::super::FAILURE_TTL);
                self.revision = self.revision.saturating_add(1);
            } else if entry.inflight.is_none() && now >= entry.retry_at {
                // Unknown metadata times out honestly; it is never an empty successful quote.
                if entry.profile.is_none() && entry.phase == Phase::Loading {
                    entry.phase = Phase::Failed;
                    entry.error = Some(Failure::Network);
                    entry.retry_at = now.saturating_add(super::super::FAILURE_TTL);
                } else {
                    entry.refresh(store, recipient, now);
                }
                self.revision = self.revision.saturating_add(1);
            }
        }
        let mut active = self
            .entries
            .values()
            .filter(|e| e.inflight.is_some())
            .count();
        let mut ready: Vec<_> = self
            .wanted
            .iter()
            .filter_map(|key| {
                self.entries
                    .get(key)
                    .filter(|entry| {
                        entry.phase == Phase::Loading
                            && entry.inflight.is_none()
                            && entry.binding.is_some()
                    })
                    .map(|entry| (!urgent.contains(key), entry.last_attempt, key.clone()))
            })
            .collect();
        // Never-attempted recipients precede retries. A completed attempt keeps
        // its turn across profile refreshes and negative-cache expiry.
        ready.sort();
        for (_, _, recipient) in ready {
            if active >= MAX_HTTP {
                break;
            }
            let Some(entry) = self.entries.get_mut(&recipient) else {
                continue;
            };
            if entry.phase != Phase::Loading || entry.inflight.is_some() {
                continue;
            }
            let Some(binding) = &entry.binding else {
                continue;
            };
            self.serial = self.serial.checked_add(1).ok_or(Failure::TooLarge)?;
            let token = self.serial;
            entry.inflight = Some((token, now.saturating_add(15)));
            entry.last_attempt = token;
            work.fetch.push(Discovery {
                token,
                binding: binding.clone(),
            });
            active += 1;
        }
        Ok(work)
    }
}
