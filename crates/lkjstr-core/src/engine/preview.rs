//! Lowest-priority optional work. Answers and attempts are bounded to 2048 links, oldest dropped.
use serde_json::{Value, json};
use std::collections::{BTreeMap, VecDeque};
#[derive(Default)]
pub struct Previews {
    pub available: bool,
    answers: BTreeMap<String, Option<Value>>,
    order: VecDeque<String>,
    now: u64,
    expires: BTreeMap<String, u64>,
}
impl Previews {
    pub fn tick(&mut self, now: u64) {
        self.now = now;
        self.answers
            .retain(|url, _| self.expires.get(url).is_none_or(|at| *at > now));
        self.expires.retain(|_, at| *at > now);
        self.order.retain(|url| self.answers.contains_key(url));
    }
    pub fn begin(&mut self, url: &str) -> bool {
        if !self.available || self.answers.contains_key(url) {
            return false;
        }
        while self.order.len() >= 2048 {
            if let Some(key) = self.order.pop_front() {
                self.answers.remove(&key);
                self.expires.remove(&key);
            }
        }
        self.order.push_back(url.into());
        self.answers.insert(url.into(), None);
        true
    }
    pub fn finish(&mut self, url: &str, answer: Option<Value>) {
        if let Some(v) = self.answers.get_mut(url) {
            let answer = answer.filter(|a| {
                a["kind"] != "link" && a["title"].as_str().is_some_and(|s| !s.trim().is_empty())
            });
            let ttl = if answer.is_some() {
                86_400_000
            } else {
                3_600_000
            };
            self.expires
                .insert(url.into(), self.now.saturating_add(ttl));
            *v = Some(answer.unwrap_or_else(|| json!({"url":url,"kind":"link"})));
        }
    }
    pub fn unasked(&self, url: &str) -> bool {
        !self.answers.contains_key(url)
    }
    pub fn cards(&self, row: &Value) -> Vec<Value> {
        links(row)
            .into_iter()
            .filter_map(|url| {
                let mut card = self
                    .answers
                    .get(&url)
                    .and_then(Option::as_ref)
                    .cloned()
                    .unwrap_or_else(|| json!({"url":url,"kind":"loading"}));
                if card["kind"] != "loading"
                    && (card["kind"] == "link"
                        || !card["title"].as_str().is_some_and(|s| !s.trim().is_empty()))
                {
                    return None;
                }
                card["source"] = json!(url);
                Some(card)
            })
            .collect()
    }
}
/// Segments are already parsed by lkjstr-protocol. Media and nostr references are separate segments.
pub fn links(row: &Value) -> Vec<String> {
    let mut links = Vec::new();
    if let Some(segments) = row["segments"].as_array() {
        for segment in segments {
            if segment["k"] != "link" {
                continue;
            }
            if let Some(url) = segment["url"].as_str().filter(|s| {
                s.len() <= 4096 && (s.starts_with("https://") || s.starts_with("http://"))
            }) {
                if !links.iter().any(|s| s == url) {
                    links.push(url.to_owned());
                }
                if links.len() == 2 {
                    break;
                }
            }
        }
    }
    links
}
