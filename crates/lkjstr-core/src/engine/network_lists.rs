//! A visible owner's Home owns its live kind-3 watch; ordinary list lookups stay finite.
use super::*;
pub(super) fn views(wants: &[(String, NostrFilter, Query)]) -> BTreeSet<String> {
    // Bound: the engine's at most 128 visible views.
    wants
        .iter()
        .filter(|(_, f, q)| q.source == Source::TheirHome && f.kinds.as_deref() == Some(&[3]))
        .map(|(sub, _, _)| sub.clone())
        .collect()
}
pub(super) fn watch(f: &NostrFilter, members: &BTreeSet<String>, views: &BTreeSet<String>) -> bool {
    f.kinds.as_deref() == Some(&[3]) && members.iter().any(|sub| views.contains(sub))
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
