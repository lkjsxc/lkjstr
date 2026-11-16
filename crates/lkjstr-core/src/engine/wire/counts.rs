//! Note count suffixes report observed relay truncation, never pending requests.
use crate::{
    engine::{Engine, rows::Row},
    store::Query,
};
use serde_json::{Value, json};
pub(super) fn note(row: &Row, store: &crate::store::Store) -> Value {
    let zaps = store
        .referencing(&row.id)
        .iter()
        .filter(|e| {
            e.kind == 9735 && lkjstr_protocol::zap_target_event_id(e).as_deref() == Some(&row.id)
        })
        .filter_map(|e| lkjstr_protocol::zap_receipt_amount_msats(e))
        .fold(0u64, u64::saturating_add)
        / 1000;
    json!({"replies":row.counts.replies,"reposts":row.counts.reposts,
        "reactions":row.counts.reactions,"zaps":zaps,"partial":false})
}
pub(super) fn settle(row: &mut Value, e: &Engine) {
    if row["kind"] == "note" {
        let id = row["id"].as_str().unwrap_or("");
        let mut f = lkjstr_protocol::NostrFilter {
            kinds: Some(if row["channel"].is_object() {
                vec![42, 16, 7, 9735]
            } else {
                vec![1, 6, 7, 9735]
            }),
            limit: Some(200),
            ..Default::default()
        };
        f.tags.insert("e".into(), vec![id.into()]);
        row["counts"]["partial"] = json!(e.network.count_limited(&f));
    }
}
pub(super) fn profile(result: &mut Value, e: &Engine, p: &str) {
    if let Some(fields) = result.as_object_mut() {
        for field in ["following", "followers", "notes"] {
            fields.remove(field);
        }
    }
    let follows = e.store.follows(p);
    let following_known = follows.is_some() || e.network.list_loaded(&e.store, p, 3);
    if following_known {
        result["following"] = json!(follows.as_ref().map_or(0, Vec::len));
    }
    let mut partial = false;
    for (field, kinds, authors, mention) in [
        ("followers", vec![3], None, Some(p.to_owned())),
        (
            "notes",
            vec![1],
            Some([p.into()].into_iter().collect()),
            None,
        ),
    ] {
        let count = e
            .store
            .feed(&Query {
                kinds: kinds.clone(),
                authors: authors.clone(),
                mention: mention.clone(),
                limit: e.store.len(),
                ..Default::default()
            })
            .len();
        let mut f = lkjstr_protocol::NostrFilter {
            kinds: Some(kinds),
            authors: authors.map(|a: std::collections::HashSet<String>| a.into_iter().collect()),
            limit: Some(200),
            ..Default::default()
        };
        if let Some(p) = mention {
            f.tags.insert("p".into(), vec![p]);
        }
        let exact = e.network.count_complete(&f, &e.store);
        if count > 0 || exact {
            result[field] = json!(count);
            partial |= !exact;
        }
    }
    result["partial"] = json!(partial);
}
