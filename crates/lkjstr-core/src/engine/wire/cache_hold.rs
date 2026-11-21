//! Held frontend identities are untrusted lookup hints, never delivered or verified rows.
use super::{Output, Session};
use crate::engine::Engine;
use serde::Deserialize;
use std::collections::BTreeSet;

#[derive(Clone, Deserialize)]
pub struct ProfileRef {
    pub pubkey: String,
    pub id: String,
}
#[derive(Clone, Deserialize)]
pub struct QuoteRef {
    pub id: String,
}
#[derive(Clone, Deserialize)]
pub struct HeldRow {
    pub key: String,
    pub id: Option<String>,
    #[serde(default)]
    pub profiles: Vec<ProfileRef>,
    #[serde(default)]
    pub quotes: Vec<QuoteRef>,
}
#[derive(Default)]
pub(super) struct Held {
    rows: Vec<HeldRow>,
    loaded: BTreeSet<String>,
    revision: Option<u64>,
}
fn hex(id: &str) -> bool {
    id.len() == 64
        && id
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
impl HeldRow {
    fn ids(&self) -> impl Iterator<Item = &String> {
        self.id
            .iter()
            .chain(self.profiles.iter().map(|r| &r.id))
            .chain(self.quotes.iter().map(|r| &r.id))
    }
}
impl Session {
    pub(super) fn cache_release(&mut self, sub: &str) {
        self.cache_policies.remove(sub);
        self.cache_held.remove(sub);
    }
    fn cache_active(&self, sub: &str, engine: &Engine) -> bool {
        !self.preview_hidden
            && self
                .timeline_visible
                .as_ref()
                .is_none_or(|v| v.contains(sub))
            && self.public_cache_allowed(sub, engine)
    }
    pub(super) fn cache_hold(&mut self, sub: String, rows: Vec<HeldRow>, engine: &Engine) {
        if !self.cache_active(&sub, engine) {
            self.cache_held.remove(&sub);
            return;
        }
        let mut keys = BTreeSet::new();
        let rows: Vec<_> = rows
            .into_iter()
            .take(64)
            .filter_map(|mut row| {
                if row.key.is_empty() || row.key.len() > 512 || !keys.insert(row.key.clone()) {
                    return None;
                }
                row.id = row.id.filter(|id| hex(id));
                row.profiles.truncate(16);
                row.profiles.retain(|p| hex(&p.pubkey) && hex(&p.id));
                row.quotes.truncate(8);
                row.quotes.retain(|q| hex(&q.id));
                let useful = row.ids().next().is_some();
                useful.then_some(row)
            })
            .collect();
        let wanted: BTreeSet<_> = rows.iter().flat_map(HeldRow::ids).cloned().collect();
        let mut loaded = self
            .cache_held
            .remove(&sub)
            .map(|held| held.loaded)
            .unwrap_or_default();
        loaded.retain(|id| wanted.contains(id));
        self.cache_held.insert(
            sub,
            Held {
                rows,
                loaded,
                revision: None,
            },
        );
    }
    /// The Worker first tries these IDs in bounded public IDB batches. No socket
    /// or filter is created here; the engine planner owns residual network wants.
    pub fn cache_missing_ids(&self, engine: &Engine) -> Vec<String> {
        self.cache_held
            .iter()
            .filter(|(sub, _)| self.cache_active(sub, engine))
            .flat_map(|(_, held)| {
                held.rows
                    .iter()
                    .flat_map(HeldRow::ids)
                    .filter(|id| !held.loaded.contains(*id))
            })
            .filter(|id| {
                engine.store.get(id).is_none()
                    && !engine.store.verified_deleted(id)
                    && !engine.store.verified_expired(id)
            })
            .cloned()
            .collect::<BTreeSet<_>>()
            .into_iter()
            .take(32)
            .collect()
    }
    pub fn cache_mark_loaded(&mut self, ids: &[String]) {
        for held in self.cache_held.values_mut() {
            let wanted: BTreeSet<_> = held.rows.iter().flat_map(HeldRow::ids).cloned().collect();
            held.loaded
                .extend(ids.iter().filter(|id| wanted.contains(*id)).cloned());
            held.revision = None;
        }
    }
    /// IDs remain unresolved after a successful local lookup. These are facts
    /// for the single planner, not independently scheduled relay requests.
    pub fn cache_unresolved_ids(&self, engine: &Engine) -> Vec<(String, Vec<String>)> {
        self.cache_held
            .iter()
            .filter(|(sub, _)| self.cache_active(sub, engine))
            .map(|(sub, held)| {
                (
                    sub.clone(),
                    held.rows
                        .iter()
                        .flat_map(HeldRow::ids)
                        .filter(|id| {
                            held.loaded.contains(*id)
                                && engine.store.get(id).is_none()
                                && !engine.store.verified_deleted(id)
                                && !engine.store.verified_expired(id)
                        })
                        .cloned()
                        .collect::<BTreeSet<_>>()
                        .into_iter()
                        .collect(),
                )
            })
            .filter(|(_, ids): &(String, Vec<String>)| !ids.is_empty())
            .collect()
    }
    pub fn cache_refresh(&mut self, engine: &Engine) -> Vec<Output> {
        let denied: Vec<_> = self
            .cache_held
            .keys()
            .filter(|sub| !self.public_cache_allowed(sub, engine))
            .cloned()
            .collect();
        for sub in denied {
            self.cache_held.remove(&sub);
        }
        let mut output = Vec::new();
        for (sub, held) in &mut self.cache_held {
            if held.revision == Some(engine.store.revision()) {
                continue;
            }
            held.revision = Some(engine.store.revision());
            let mut removed_keys = BTreeSet::new();
            let mut invalid_profile_ids = BTreeSet::new();
            let mut removed_quote_ids = BTreeSet::new();
            held.rows.retain_mut(|row| {
                if row.id.as_deref().is_some_and(|id| {
                    engine.store.verified_deleted(id) || engine.store.verified_expired(id)
                }) {
                    removed_keys.insert(row.key.clone());
                    return false;
                }
                row.profiles.retain(|p| {
                    if engine.store.verified_deleted(&p.id) {
                        invalid_profile_ids.insert(p.id.clone());
                        false
                    } else {
                        true
                    }
                });
                row.quotes.retain(|q| {
                    if engine.store.verified_deleted(&q.id) || engine.store.verified_expired(&q.id)
                    {
                        removed_quote_ids.insert(q.id.clone());
                        false
                    } else {
                        true
                    }
                });
                true
            });
            if !removed_keys.is_empty()
                || !invalid_profile_ids.is_empty()
                || !removed_quote_ids.is_empty()
            {
                output.push(Output::CacheReconcile {
                    sub: sub.clone(),
                    removed_keys: removed_keys.into_iter().collect(),
                    invalid_profile_ids: invalid_profile_ids.into_iter().collect(),
                    removed_quote_ids: removed_quote_ids.into_iter().collect(),
                });
            }
        }
        output
    }
}
#[cfg(test)]
#[path = "cache_hold_test.rs"]
mod tests;
