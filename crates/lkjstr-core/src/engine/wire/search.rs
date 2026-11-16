//! Search people are a bounded header; native windows and patch indexes stay note-only.
use super::{Output, Session, output_diff::diff};
use crate::engine::{Engine, protocol as p, rows};
#[path = "../search_people.rs"]
mod policy;
use serde_json::{Value, json};
#[derive(Default)]
pub(super) struct Cached {
    top: bool,
    generation: Option<(u64, u64)>,
    people: Vec<Value>, // At most six rows per admitted subscription (at most 128).
}
pub(super) struct Context {
    sub: String,
    previous: Vec<Value>,
}
fn header(row: &Value) -> bool {
    row["kind"] == "person"
        && row["key"]
            .as_str()
            .is_some_and(|key| key.starts_with("search-person:"))
}
impl Session {
    pub(super) fn search_before(&mut self, output: &p::Output) -> Option<Context> {
        let (sub, top) = match output {
            p::Output::Rows { sub, at_top, .. } => (sub, Some(*at_top)),
            p::Output::Fresh { sub, count } => (sub, Some(*count == 0)),
            p::Output::Patch { sub, .. } => (sub, None),
            _ => return None,
        };
        if self.queries.get(sub).is_none_or(|q| q.source != "search") {
            return None;
        }
        let cache = self.searches.entry(sub.clone()).or_default();
        let previous = if cache.top {
            cache.people.clone()
        } else {
            vec![]
        };
        if let Some(top) = top {
            cache.top = top;
        }
        if let Some(rows) = self.delivered.get_mut(sub) {
            rows.retain(|row| !header(row));
        }
        Some(Context {
            sub: sub.clone(),
            previous,
        })
    }
    pub(super) fn search_after(
        &mut self,
        context: Context,
        output: &mut Vec<Output>,
        engine: &Engine,
    ) {
        let Context { sub, mut previous } = context;
        let Some(query) = self.queries.get(&sub) else {
            return;
        };
        let cache = self.searches.entry(sub.clone()).or_default();
        let generation = (
            engine.store.snapshot_revision(),
            engine.private_reads.revision,
        );
        if cache.top && cache.generation != Some(generation) {
            cache.people = policy::select(&engine.store,&engine.private_lists,
                query.account.as_deref(),query.text.as_deref().unwrap_or(""))
                .into_iter().map(|person| {
                    let key = person.pubkey;
                    json!({"kind":"person","key":format!("search-person:{key}"),
                        "weight":person.weight,"author":super::note::author(&rows::author(&engine.store,&key)),
                        "about":engine.store.profile(&key).map(|p|p.about.lines().next().unwrap_or("").chars().take(160).collect::<String>()).unwrap_or_default(),
                        "followed":person.followed,"followsYou":person.follows_you,"self":person.own})
                }).collect();
            cache.generation = Some(generation);
        }
        let prefix = if cache.top {
            cache.people.clone()
        } else {
            vec![]
        };
        let mut notes = self.delivered.remove(&sub).unwrap_or_default();
        let mut replaced = false;
        for message in output.iter_mut() {
            if let Output::Rows {
                sub: row_sub, rows, ..
            } = message
                && row_sub == &sub
            {
                let mut next = prefix.clone();
                next.append(rows);
                *rows = next;
                replaced = true;
            }
        }
        if !replaced {
            let mut next = prefix.clone();
            // One identical sentinel keeps new headers before notes, without diffing
            // or copying the entire retained note window for a directory change.
            if let Some(first) = notes.first() {
                let sentinel = json!({"key":first["key"]});
                previous.push(sentinel.clone());
                next.push(sentinel);
            }
            let ops = diff(&previous, &next);
            if !ops.is_empty() {
                output.push(Output::Patch {
                    sub: sub.clone(),
                    ops,
                });
            }
        }
        let mut delivered = prefix;
        delivered.append(&mut notes);
        self.delivered.insert(sub, delivered);
    }
    /// Leaving the header holds the first note boundary; an empty note span stays at top.
    pub(super) fn search_header_anchor(&self, sub: &str, key: &str) -> Option<Option<String>> {
        let cache = self.searches.get(sub)?;
        if !cache.top || !cache.people.iter().any(|row| row["key"] == key) {
            return None;
        }
        let delivered = self.delivered.get(sub)?;
        if !delivered.iter().any(|row| header(row) && row["key"] == key) {
            return None;
        }
        Some(
            delivered
                .iter()
                .find(|row| row["kind"] == "note")
                .and_then(|row| row["key"].as_str())
                .map(str::to_owned),
        )
    }
}

#[cfg(test)]
#[path = "../search_people_workload.rs"]
mod workload;
