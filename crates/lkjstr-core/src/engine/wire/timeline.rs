//! Incremental time index. One 256-row slice per client tick, round robin across
//! at most 128 subscriptions. Current/prior key maps and the ordinal lookup each
//! retain at most one store-capacity snapshot; close releases all three. Local days
//! (timeline_days.rs) come from the same scan. Grouped and activity lists index their own
//! projected rows instead (timeline_projected.rs).
use super::timeline_answer::Lookup;
use super::timeline_days::Days;
use super::timeline_projected as projected;
use super::{Output, Session};
use crate::engine::{Engine, protocol::Source, query};
use serde_json::{Value, json};
use std::collections::BTreeMap;
#[cfg(test)]
#[path = "timeline_horizon_test.rs"]
mod horizon_tests;
#[path = "timeline_rebuild.rs"]
mod rebuild;
#[derive(Default)]
pub(super) struct Index {
    pub(super) revision: u64,
    horizon: Option<u64>,
    started: u64,
    month: u64,
    cursor: Option<(u64, String)>,
    pub(super) done: bool,
    pub(super) supported: bool,
    // Built incrementally, newest first; month counters and lookup avoid a final full-store pass.
    pub(super) keys: BTreeMap<u64, Vec<String>>,
    previous: BTreeMap<u64, Vec<String>>,
    pub(super) positions: Lookup,
    /// The last finished lookup, kept only while its replacement builds.
    prior: Lookup,
    last: Option<Value>,
    pub(super) newest: Option<u64>,
    pub(super) oldest: u64,
    pub(super) days: Days,
    /// A projected list's (key, time) rows, taken once per build; at most one store-sized list.
    pub(super) rows: Option<Vec<(String, u64)>>,
    pub(super) next: usize,
}
impl Index {
    pub(super) fn key(&self, month: u64, offset: usize, horizon: Option<u64>) -> Option<String> {
        if horizon > self.horizon {
            return None;
        }
        let keys = if self.done {
            &self.keys
        } else {
            &self.previous
        };
        keys.get(&month)
            .and_then(|list| list.get(offset).or_else(|| list.last()))
            .cloned()
    }
}
// Gregorian month start from epoch seconds, without a platform clock or date library.
pub fn month_start(seconds: u64) -> u64 {
    let days = seconds / 86400;
    let z = days as i64 + 719468;
    let era = z / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    (days - (day as u64 - 1)) * 86400 * 1000
}
fn eligible(q: &crate::engine::protocol::Query, e: &Engine) -> bool {
    e.cached_history_complete
        && e.store.evictions() == 0
        && matches!(
            q.source,
            Source::Home
                | Source::TheirHome
                | Source::Notifications
                | Source::Global
                | Source::Hashtag
                | Source::Search
                | Source::Profile
                | Source::Channel
                | Source::Relay
        )
        // Signed-out Global holds rows by their window's context (global.rs): no cache-wide ordinal exists.
        && !(q.source == Source::Global && q.account.is_none())
}
impl Session {
    /// Called once per 25ms Worker turn; never scans more than 256 retained events per client.
    /// Results debounce for 100ms and are resent only when counts, window positions or ends change.
    pub fn timeline_tick(&mut self, e: &Engine, now: u64) -> Vec<Output> {
        let subs: Vec<_> = self
            .queries
            .keys()
            .filter(|sub| {
                self.timeline_visible
                    .as_ref()
                    .is_none_or(|v| v.contains(*sub))
            })
            .cloned()
            .collect();
        if subs.is_empty() {
            return vec![];
        }
        self.timeline_turn = (self.timeline_turn + 1) % subs.len();
        let sub = &subs[self.timeline_turn];
        let Some(q) = self.queries[sub].convert() else {
            return vec![];
        };
        let sub = sub.clone();
        // Out of the map while it is built, so a projected list can read this session's rows.
        let mut taken = self.timelines.remove(&sub).unwrap_or_default();
        let out = self.timeline_step(&sub, &q, &mut taken, e, now);
        self.timelines.insert(sub.clone(), taken);
        out.map(|timeline| Output::Timeline { sub, timeline })
            .into_iter()
            .collect()
    }

    fn timeline_step(
        &self,
        sub: &str,
        q: &crate::engine::protocol::Query,
        index: &mut Index,
        e: &Engine,
        now: u64,
    ) -> Option<Value> {
        let revision = e.store.revision();
        let horizon = self.history_horizon(sub, e);
        let month = month_start(now / 1000);
        let (zone, today) = (e.calendar.zone(), e.calendar.day_start(now));
        let stale = (index.done && (index.revision != revision || index.horizon != horizon))
            || horizon > index.horizon
            || e.store.snapshot_revision() > index.revision
            || index.month != month
            || index.days.stale(&zone, today)
            || (index.supported && !eligible(q, e));
        let counted = index.done && !stale;
        if stale {
            *index = index.rebuild(Index {
                revision,
                horizon,
                month,
                started: now,
                supported: eligible(q, e),
                days: Days::new(zone, today),
                ..Default::default()
            });
        }
        // A deeper horizon joins the next bounded scan. The current map stays
        // within the covered part and can finish while relay pages stream in.
        let horizon = index.horizon;
        if !index.done
            && now.saturating_sub(index.started) >= 100
            && (horizon.is_some() || projected::projected(q))
        {
            index
                .rows
                .get_or_insert_with(|| projected::subscription_rows(self, sub, e, q, horizon));
            projected::slice(index, &*e.calendar, now);
        } else if !index.done && now.saturating_sub(index.started) >= 100 {
            let filter = query::filter(&e.store, q);
            let authors = crate::engine::rich::authors(&e.store, q);
            let batch = e.store.scan(index.cursor.as_ref(), 256);
            let profile_all =
                q.source == Source::Profile && q.filters.show.as_deref() == Some("all");
            let profile_posts = query::profile_posts(q);
            let openable = profile_posts
                || q.source == Source::Profile
                    && matches!(
                        q.filters.show.as_deref(),
                        Some("articles" | "lists" | "all")
                    );
            for event in &batch {
                if horizon.is_some_and(|at| event.created_at < at) {
                    index.done = true;
                    break;
                }
                index.cursor = Some((event.created_at, event.id.clone()));
                if !e.store.existed_at(&event.id, index.revision)
                    || query::signed_out(q)
                    || !query::accepts(&e.store, q, event, &filter, &authors)
                {
                    continue;
                }
                let Some(row) = (if profile_all {
                    Some(event.clone())
                } else {
                    query::collapse_repost(&e.store, q, event.clone())
                }) else {
                    continue;
                };
                // The first matching original or wrapper owns the row, in the same order as the window.
                if (!profile_all
                    && (event.kind == 6
                        || (profile_posts && crate::engine::acts::is_repost(event.kind)))
                    && row.id == event.id)
                    || horizon.is_some_and(|at| row.created_at < at)
                    || index.positions.contains_key(&row.id)
                {
                    continue;
                }
                if if openable {
                    !crate::kinds::policy(row.kind).openable
                } else {
                    !matches!(row.kind, 1 | 42)
                } {
                    index.supported = false;
                    index.done = true;
                    break;
                }
                let time = event.created_at.saturating_mul(1000);
                index.newest.get_or_insert(time);
                index.oldest = time;
                let at = month_start(event.created_at.min(now / 1000));
                let keys = index.keys.entry(at).or_default();
                let offset = keys.len();
                index.positions.insert(row.id.clone(), (at, offset, time));
                keys.push(row.id.clone());
                index.days.count(&*e.calendar, time.min(now), at, offset);
            }
            if batch.len() < 256 {
                index.done = true;
            }
        }
        if counted || !index.done {
            return index.update_window(self, sub, e, counted);
        }
        index.prior = Lookup::new();
        let months: Vec<_> = index
            .keys
            .iter()
            .rev()
            .map(|(at, keys)| json!({"at":at,"count":keys.len()}))
            .collect();
        let mut value = json!({"newest":index.newest.unwrap_or(0),"oldest":index.oldest,"supported":index.supported,"months":if index.supported {months} else {vec![]}});
        self.window_fields(sub, &index.positions, e, &mut value);
        if index.supported {
            index.days.fields(&mut value);
        }
        if index.last.as_ref() == Some(&value) {
            return None;
        }
        index.last = Some(value.clone());
        Some(value)
    }
}
