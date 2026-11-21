//! Reasons tied to verified events that already satisfy source selection.
use super::{protocol::Query, query_hidden, rows, settings::PrivateLists};
use crate::store::Store;
use lkjstr_protocol::NostrEvent;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Reason {
    MutedPerson,
    MutedThread,
    MutedWord,
    MutedHashtag,
    MachinePayload,
    AuthorLimit,
    RepeatedContent,
    Deleted,
    Expired,
}

impl Reason {
    pub fn revealable(self) -> bool {
        !matches!(self, Self::Deleted | Self::Expired)
    }
}

pub(super) fn reason(
    store: &Store,
    query: &Query,
    event: &NostrEvent,
    private: &PrivateLists,
) -> Option<Reason> {
    query_hidden::reason(store, query.account.as_deref(), event, private).or_else(|| {
        (event.kind == 1 && crate::content::looks_like_noise(&event.content))
            .then_some(Reason::MachinePayload)
    })
}

pub(super) fn covered_row(store: &Store, event: &NostrEvent, reason: Reason) -> rows::Row {
    rows::Row {
        id: event.id.clone(),
        author: rows::author(store, &event.pubkey),
        created_at: event.created_at,
        kind: event.kind,
        content: vec![],
        reply: None,
        reposts: vec![],
        reposted_at: None,
        warning: None,
        counts: rows::Counts {
            replies: 0,
            reposts: 0,
            reactions: 0,
            partial: false,
        },
        reactions: vec![],
        own: rows::Own {
            reposted: false,
            bookmarked: false,
            muted: false,
        },
        hidden_reason: Some(reason),
    }
}

impl super::Engine {
    pub fn advance_visibility_clock(&mut self, now: u64) {
        if self.store.advance_clock(now / 1000) {
            self.pending.discard_expired(&self.store);
            self.network.profiles_changed = true;
            self.invalidate();
        }
    }
}

impl super::Engine {
    pub(super) fn record_invalid_delivery(
        &mut self,
        relay: &str,
        wire: Option<&str>,
        sequence: u64,
    ) {
        let Some(wire) = wire else {
            return;
        };
        let owners: std::collections::BTreeSet<_> = self
            .network
            .requests
            .values()
            .filter(|request| {
                request.relay == relay
                    && request.wire_id == wire
                    && request.asked
                    && matches!(request.purpose, "visible" | "focused" | "history")
            })
            .flat_map(|request| request.members.iter())
            .collect();
        for (sub, view) in &mut self.views {
            if sequence > view.opened_after && owners.contains(sub) {
                view.invalid_deliveries = view.invalid_deliveries.saturating_add(1);
                view.dirty = true;
            }
        }
    }
}

/// A view owns one low-priority kind-5 read over retained notes near its anchor.
/// Roster, policy, channel directory and notification rows need no note fence.
pub(super) fn deletion_filter(
    store: &Store,
    view: &super::View,
    events: &[crate::store::Event],
    held: &[Option<super::global::Held>],
) -> Option<lkjstr_protocol::NostrFilter> {
    use super::protocol::Source;
    if !matches!(
        view.query.source,
        Source::Home
            | Source::Global
            | Source::TheirHome
            | Source::Search
            | Source::Hashtag
            | Source::Relay
            | Source::Thread
            | Source::Channel
            | Source::Bookmarks
            | Source::Profile
    ) {
        return None;
    }
    let start = view
        .anchor
        .as_deref()
        .and_then(|id| events.iter().position(|event| event.id == id))
        .map_or(0, |index| index.saturating_sub(40));
    let mut targets = std::collections::BTreeSet::new();
    let mut authors = std::collections::BTreeSet::new();
    for (event, _) in events
        .iter()
        .zip(held)
        .skip(start)
        .filter(|(_, held)| super::global::has_slot(**held))
    {
        let event = if super::acts::is_act(event.kind) {
            super::acts::resolve(store, event).note
        } else {
            Some(event.clone())
        };
        let Some(event) = event.filter(|event| matches!(event.kind, 1 | 42 | 30023)) else {
            continue;
        };
        targets.insert(event.id.clone());
        authors.insert(event.pubkey.clone());
        if targets.len() == 120 {
            break;
        }
    }
    if targets.is_empty() {
        return None;
    }
    Some(lkjstr_protocol::NostrFilter {
        kinds: Some(vec![5]),
        authors: Some(authors.into_iter().collect()),
        tags: [("e".into(), targets.into_iter().collect())]
            .into_iter()
            .collect(),
        limit: Some(200),
        ..Default::default()
    })
}

impl super::Engine {
    pub(super) fn visibility_diagnostics(&self) -> serde_json::Value {
        let (expired, invalid_expiration) = self.store.expiration_evidence();
        serde_json::json!({"invalidFrames":self.network.invalid_frames,
            "unmatchedFrames":self.network.unmatched_frames,
            "repeatedDeliveries":self.network.repeated_deliveries,
            "verificationRejections":self.rejected, "queueDrops":self.dropped,
            "evictions":self.store.evictions(), "expired":expired, "invalidExpiration":invalid_expiration})
    }
}
