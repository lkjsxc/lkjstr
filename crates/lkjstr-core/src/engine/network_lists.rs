//! Their Home follows and mutes, and explicit pin watches, stay live while owned.
use super::*;
pub(super) fn views(wants: &[(String, NostrFilter, Query)]) -> BTreeMap<String, String> {
    // Bound: the engine's at most 128 visible views, with no account authority.
    wants
        .iter()
        .filter(|(_, _, q)| q.source == Source::TheirHome)
        .filter_map(|(sub, _, q)| q.target.as_ref().map(|owner| (sub.clone(), owner.clone())))
        .collect()
}
pub(super) fn watch(
    f: &NostrFilter,
    members: &BTreeSet<String>,
    views: &BTreeMap<String, String>,
) -> bool {
    match f.kinds.as_deref() {
        // Account discovery already owns a live tail and keeps its quiet settled-slot policy.
        Some([10001]) if f.since.is_none() && f.until.is_none() => members
            .iter()
            .any(|sub| !sub.starts_with('~') || sub.starts_with("~list-action:")),
        Some([3] | [10000]) => f.authors.as_deref().is_some_and(|authors| {
            authors.len() == 1 && members.iter().any(|sub| views.get(sub) == authors.first())
        }),
        _ => false,
    }
}
impl Request {
    pub(super) fn watch_list(&mut self, live: bool, now: u64) -> bool {
        let close = self.live && !live && self.eose && self.sent;
        if live && !self.live && self.complete {
            self.complete = false;
            self.eose = false;
            self.page_eose = false;
            self.asked = false;
            self.ready_at = now;
        }
        self.live = live;
        if close {
            self.complete = true;
            self.sent = false;
        }
        close
    }
}
