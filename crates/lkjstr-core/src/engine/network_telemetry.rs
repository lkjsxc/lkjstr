//! Record scheduler decisions and transport observations at their source.
use super::*;
use crate::engine::telemetry::{Kind, relay_url};
use url::Url;

impl Network {
    pub(super) fn send(&mut self, relay: &str, value: Value) {
        let text = value.to_string();
        if let Some(r) = self.relays.get_mut(relay) {
            r.sent += 1;
            r.bytes_out += text.len() as u64;
        }
        self.effects.push(Effect::Send(relay.into(), text));
    }

    pub(super) fn sent_frame(&mut self, text: &str, now: u64) {
        self.telemetry.traffic(now, |bucket| {
            bucket.bytes_out += text.len() as u64;
            bucket.reqs_sent += u64::from(text.starts_with("[\"REQ\","));
        });
    }

    pub(in crate::engine) fn mark_auth_required(&mut self, relay: &str) {
        if let Some(state) = self.relays.get_mut(relay) {
            state.auth_required = true;
        }
        self.telemetry.auth_required(relay);
    }

    pub(in crate::engine) fn is_private_relay(&self, relay: Option<&str>) -> bool {
        relay.is_none_or(|relay| self.private_origin(relay, relay_url(relay).as_ref()))
    }

    pub(in crate::engine) fn relay_display(&self, relay: &str) -> (String, bool) {
        let url = relay_url(relay);
        let private = self.private_origin(relay, url.as_ref());
        (
            url.map_or_else(|| "private-relay".into(), Url::into),
            private,
        )
    }

    fn private_origin(&self, raw: &str, parsed: Option<&Url>) -> bool {
        self.relays.get(raw).is_some_and(|r| r.auth_required) || self.telemetry.is_private(parsed)
    }

    pub(super) fn stats_relay_label(&self, relay: &str) -> String {
        let (label, private) = self.relay_display(relay);
        if private {
            "private-relay".into()
        } else {
            label
        }
    }

    pub(super) fn decision(&mut self, now: u64, kind: Kind, relay: &str) {
        self.decision_detail(now, kind, relay, None, None);
    }

    pub(super) fn decision_detail(
        &mut self,
        now: u64,
        kind: Kind,
        relay: &str,
        count: Option<usize>,
        delay: Option<u64>,
    ) {
        self.decision_for(now, kind, relay, None, count, delay);
    }

    pub(super) fn decision_for(
        &mut self,
        now: u64,
        kind: Kind,
        relay: &str,
        view: Option<u64>,
        count: Option<usize>,
        delay: Option<u64>,
    ) {
        let url = relay_url(relay);
        let label = if self.private_origin(relay, url.as_ref()) {
            "private-relay".into()
        } else {
            url.map_or_else(
                || "private-relay".into(),
                |url| url.origin().ascii_serialization(),
            )
        };
        self.telemetry
            .decision(now, kind, Some(label), view, count, delay);
    }

    pub(super) fn observe_publication(
        &mut self,
        id: &str,
        relay: &str,
        now: u64,
        fallback: bool,
        accepted: bool,
    ) {
        if (fallback || accepted) && self.publication_is_public(id) {
            let kind = if accepted {
                Kind::PublishOk
            } else {
                Kind::Fallback
            };
            self.decision(now, kind, relay);
        }
    }

    fn publication_is_public(&self, id: &str) -> bool {
        self.publications
            .get(id)
            .map(|p| p.event.kind)
            .or_else(|| self.publication_kind(id))
            .is_some_and(publication_kind_is_public)
    }
}

pub(in crate::engine) fn publication_kind_is_public(kind: u64) -> bool {
    crate::kinds::policy(kind).retained && !matches!(kind, 10050)
}

pub(super) fn public_filter(filter: &NostrFilter) -> bool {
    filter.kinds.as_ref().is_some_and(|kinds| {
        !kinds.is_empty() && kinds.iter().all(|&kind| publication_kind_is_public(kind))
    })
}

impl Request {
    pub(super) fn shared_members_added(&self, members: &BTreeSet<String>) -> Option<(Kind, usize)> {
        (self.sent
            && members.len() > 1
            && !members.is_subset(&self.members)
            && public_filter(&self.filter))
        .then(|| (Kind::Coalesce, members.difference(&self.members).count()))
    }

    pub(super) fn visible_in_stats(&self) -> bool {
        !self.members.iter().any(|member| member.starts_with("~dm"))
            && self.filter.kinds.as_ref().is_none_or(|kinds| {
                !kinds
                    .iter()
                    .any(|kind| matches!(kind, 4 | 13 | 14 | 1059 | 10050))
            })
    }
}
