//! Read models for the status surface: per-want progress and relay health.

use lkjstr_core::plan::WantId;

use super::Rt;
use super::net::SubState;
use crate::host::now_ms;

pub use lkjstr_core::requests::Progress;

#[derive(Clone, Debug, PartialEq)]
pub enum Link {
    Open,
    Connecting,
    Failed(String),
    BackingOff(u64),
}

#[derive(Clone, Debug, PartialEq)]
pub struct RelayRow {
    pub url: String,
    pub link: Option<Link>,
    pub requests: usize,
    pub score: f64,
    pub latency_ms: Option<f64>,
    pub events: u64,
    pub auth_required: bool,
    pub notice: Option<String>,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Summary {
    pub open: usize,
    pub connecting: usize,
    pub failing: usize,
    pub waiting: usize,
    pub live: usize,
    pub queued_events: usize,
}

impl Rt {
    pub fn progress(&self, want: WantId) -> Progress {
        if let Some(progress) = self.expired.get(&want) {
            return *progress;
        }
        let mut out = Progress::default();
        for sub in self
            .net
            .subs
            .values()
            .filter(|s| s.planned.wants.contains(&want))
        {
            out.total += 1;
            match sub.state {
                SubState::Live | SubState::Done => out.answered += 1,
                SubState::Failed(_) => out.failed += 1,
                SubState::Queued | SubState::Waiting => {}
            }
        }
        out
    }

    /// Missing references share their prefetch want's completion state.
    pub fn lookup(&self, event_id: &str) -> lkjstr_core::requests::Lookup {
        let mut progress = Progress::default();
        let mut found = false;
        for (id, want) in &self.wants {
            if matches!(want, lkjstr_core::plan::Want::Events { ids, .. } if ids.iter().any(|id| id == event_id))
            {
                progress.add(self.progress(*id));
                found = true;
            }
        }
        lkjstr_core::requests::Lookup::from_progress(
            (found && !self.flags.replan).then_some(progress),
        )
    }

    fn link(&self, url: &str) -> Option<Link> {
        let now = now_ms();
        let stats = self.scores.get(url);
        if let Some(conn) = self.net.conns.get(url) {
            if conn.open {
                return Some(Link::Open);
            }
            if conn.socket.is_some() {
                return Some(Link::Connecting);
            }
            if let Some(error) = &conn.error {
                if !stats.usable(now) {
                    return Some(Link::BackingOff(stats.backoff_until_ms - now));
                }
                return Some(Link::Failed(error.clone()));
            }
        }
        (!stats.usable(now)).then(|| Link::BackingOff(stats.backoff_until_ms - now))
    }

    /// Relays in use or known, busiest first.
    pub fn relay_rows(&self) -> Vec<RelayRow> {
        let now = now_ms();
        let mut urls: Vec<String> = self.net.conns.keys().cloned().collect();
        urls.extend(self.defaults.read.iter().cloned());
        urls.extend(self.scores.relays.keys().cloned());
        urls.sort();
        urls.dedup();
        let mut rows: Vec<RelayRow> = urls
            .into_iter()
            .map(|url| {
                let stats = self.scores.get(&url);
                RelayRow {
                    link: self.link(&url),
                    requests: self
                        .net
                        .subs
                        .values()
                        .filter(|s| s.planned.relay == url)
                        .count(),
                    score: stats.score(now),
                    latency_ms: stats.latency_ms,
                    events: stats.events,
                    auth_required: stats.auth_required,
                    notice: self.net.conns.get(&url).and_then(|c| c.notice.clone()),
                    url,
                }
            })
            .collect();
        rows.sort_by(|a, b| {
            (b.link == Some(Link::Open), b.requests)
                .cmp(&(a.link == Some(Link::Open), a.requests))
                .then(a.url.cmp(&b.url))
        });
        rows
    }

    pub fn summary(&self) -> Summary {
        let mut out = Summary {
            queued_events: self.incoming.len(),
            ..Summary::default()
        };
        for url in self.net.conns.keys() {
            match self.link(url) {
                Some(Link::Open) => out.open += 1,
                Some(Link::Connecting) => out.connecting += 1,
                Some(_) => out.failing += 1,
                None => {}
            }
        }
        for sub in self.net.subs.values() {
            match sub.state {
                SubState::Waiting | SubState::Queued => out.waiting += 1,
                SubState::Live => out.live += 1,
                _ => {}
            }
        }
        out
    }
}
