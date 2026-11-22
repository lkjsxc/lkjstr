//! Incremental cache-only time index. One 256-event slice per client tick, round robin across
//! at most 128 subscriptions. Current/prior key maps and the ordinal lookup each
//! retain at most one store-capacity snapshot; close releases all three. Local days
//! (timeline_days.rs) come from the same scan.
use super::timeline_days::Days;
use super::{Output, Session};
use crate::engine::{Engine, protocol::Source, query};
use serde_json::{Value, json};
use std::collections::BTreeMap;
#[derive(Default)]
pub(super) struct Index {
    revision: u64,
    started: u64,
    month: u64,
    cursor: Option<(u64, String)>,
    done: bool,
    supported: bool,
    // Built incrementally, newest first; month counters and lookup avoid a final full-store pass.
    keys: BTreeMap<u64, Vec<String>>,
    previous: BTreeMap<u64, Vec<String>>,
    positions: BTreeMap<String, (u64, usize)>,
    last: Option<Value>,
    newest: Option<u64>,
    oldest: u64,
    days: Days,
}
impl Index {
    pub(super) fn key(&self, month: u64, offset: usize) -> Option<String> {
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
                | Source::Global
                | Source::Hashtag
                | Source::Search
                | Source::Profile
                | Source::Channel
                | Source::Relay
        )
        && q.filters.notifications != Some(true)
        && !matches!(q.filters.show.as_deref(), Some("reposts" | "reactions"))
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
        let revision = e.store.revision();
        let month = month_start(now / 1000);
        let (zone, today) = (e.calendar.zone(), e.calendar.day_start(now));
        let index = self.timelines.entry(sub.clone()).or_default();
        if (index.done && index.revision != revision)
            || e.store.snapshot_revision() > index.revision
            || index.month != month
            || index.days.stale(&zone, today)
            || (index.supported && !eligible(&q, e))
        {
            let last = index.last.take();
            let previous = if index.done {
                std::mem::take(&mut index.keys)
            } else {
                std::mem::take(&mut index.previous)
            };
            *index = Index {
                revision,
                previous,
                month,
                started: now,
                supported: eligible(&q, e),
                last,
                days: Days::new(zone, today),
                ..Default::default()
            };
            index.done = !index.supported;
        }
        if !index.done && now.saturating_sub(index.started) >= 100 {
            let filter = query::filter(&e.store, &q);
            let authors = crate::engine::rich::authors(&e.store, &q);
            let batch = e.store.scan(index.cursor.as_ref(), 256);
            for event in &batch {
                index.cursor = Some((event.created_at, event.id.clone()));
                if !e.store.existed_at(&event.id, index.revision)
                    || query::signed_out(&q)
                    || !query::accepts(&e.store, &q, event, &filter, &authors)
                {
                    continue;
                }
                // Unresolved repost wrappers have no displayed row; ordinary windows discard them too.
                if event.kind == 6
                    && lkjstr_protocol::tags::tag_values(event, "e")
                        .last()
                        .and_then(|id| e.store.get(id))
                        .is_none()
                {
                    continue;
                }
                // Collapsed repost wrappers can display a target at a different time. Keep native scrolling.
                if !matches!(event.kind, 1 | 42) {
                    index.supported = false;
                    index.done = true;
                    break;
                }
                let time = event.created_at.saturating_mul(1000);
                index.newest.get_or_insert(time);
                index.oldest = time;
                let at = month_start(event.created_at.min(now / 1000));
                let keys = index.keys.entry(at).or_default();
                index.positions.insert(event.id.clone(), (at, keys.len()));
                let offset = keys.len();
                keys.push(event.id.clone());
                index.days.count(&*e.calendar, time.min(now), at, offset);
            }
            if batch.len() < 256 {
                index.done = true;
            }
        }
        if !index.done {
            return vec![];
        }
        let months: Vec<_> = index
            .keys
            .iter()
            .rev()
            .map(|(at, keys)| json!({"at":at,"count":keys.len()}))
            .collect();
        let mut positions: Vec<_> = self
            .delivered
            .get(sub)
            .into_iter()
            .flatten()
            .filter_map(|r| {
                let key = r["key"].as_str()?;
                let (month, offset) = index.positions.get(key)?;
                Some(json!({"key":key,"month":month,"offset":offset}))
            })
            .collect();
        if let Some(key) = self.return_keys.get(sub)
            && let Some((month, offset)) = index.positions.get(key)
            && !positions.iter().any(|p| p["key"].as_str() == Some(key))
        {
            positions.push(json!({"key":key,"month":month,"offset":offset}));
        }
        // Exhaustion is engine policy; a short local window says nothing about relay history.
        let older = !e
            .views
            .values()
            .filter(|v| v.query == q)
            .any(|v| v.source_exhausted);
        let mut value = json!({"newest":index.newest.unwrap_or(0),"oldest":index.oldest,"supported":index.supported,"months":if index.supported {months} else {vec![]},"positions":positions,"older":older});
        if let Some((Some(key), _, _)) = self.windows.get(sub) {
            value["anchor"] = json!(key);
        }
        if index.supported {
            index.days.fields(&mut value);
        }
        if index.last.as_ref() == Some(&value) {
            return vec![];
        }
        index.last = Some(value.clone());
        vec![Output::Timeline {
            sub: sub.clone(),
            timeline: value,
        }]
    }
}
