use super::{
    protocol::Query,
    query_predicates::matches_extra,
    settings::{PrivateLists, list_has, list_tags},
};
use crate::store::Store;
use lkjstr_protocol::{NostrEvent, reply_parent, tags::tag_values};
pub fn hidden(store: &Store, q: &Query, e: &NostrEvent) -> Option<String> {
    hidden_with_lists(store, q, e, &Default::default())
}
pub fn hidden_with_lists(
    store: &Store,
    q: &Query,
    e: &NostrEvent,
    private: &PrivateLists,
) -> Option<String> {
    let account = q.account.as_deref();
    for (tag, value, reason) in [
        ("p", e.pubkey.clone(), "muted-person"),
        (
            "e",
            reply_parent(e).unwrap_or_else(|| e.id.clone()),
            "muted-thread",
        ),
    ] {
        if list_has(store, private, account, 10000, tag, &value) {
            return Some(reason.into());
        }
    }
    let mute = account.and_then(|a| store.replaceable(a, 10000))?;
    for t in &list_tags(&mute, private) {
        if let Some(v) = t.get(1) {
            if t.first().is_some_and(|k| k == "word")
                && e.content.to_lowercase().contains(&v.to_lowercase())
            {
                return Some("muted-word".into());
            }
            if t.first().is_some_and(|k| k == "t")
                && tag_values(e, "t").iter().any(|s| s.eq_ignore_ascii_case(v))
            {
                return Some("muted-hashtag".into());
            }
        }
    }
    None
}

pub(in crate::engine) fn matches_note(store: &Store, q: &Query, e: &NostrEvent) -> bool {
    super::rich::authors(store, q)
        .as_ref()
        .is_none_or(|a| a.contains(&e.pubkey))
        && matches_extra(e, q)
}
