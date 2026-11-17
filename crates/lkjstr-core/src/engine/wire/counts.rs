//! Note count suffixes report observed relay truncation, never pending requests.
use crate::{
    engine::{Engine, rows::Row},
    store::Query,
};
use serde_json::{Value, json};
pub(super) fn note(row: &Row, _store: &crate::store::Store) -> Value {
    json!({"replies":row.counts.replies,"reposts":row.counts.reposts,
        "reactions":row.counts.reactions,"zaps":0,"partial":false})
}
pub(super) fn settle(row: &mut Value, e: &Engine, account: Option<&str>) {
    if row["kind"] == "note" {
        let id = row["id"].as_str().unwrap_or("").to_owned();
        let mut f = lkjstr_protocol::NostrFilter {
            kinds: Some(if row["channel"].is_object() {
                vec![42, 16, 7, 9735]
            } else {
                vec![1, 6, 7, 9735]
            }),
            limit: Some(200),
            ..Default::default()
        };
        f.tags.insert("e".into(), vec![id.clone()]);
        row["counts"]["partial"] = json!(e.network.count_limited(&f));
        if let Some(mut context) = e.read_contexts.evidence(&e.store, &e.zaps.receipts, &id) {
            context.current &= !e.pending.public_policy_pending();
            let selection =
                account.and_then(|account| e.read_contexts.selection(&e.store, &context, account));
            context.current &= account.is_none() || selection.as_ref().is_some_and(|s| s.committed);
            row["counts"]["context"] = json!(context);
            if let Some(selection) = selection {
                row["counts"]["context"]["selection"] = json!(selection);
            }
        } else if let Some(counts) = row["counts"].as_object_mut() {
            counts.remove("context");
        }
        let total = e.zaps.receipts.total(
            &e.store,
            &e.zaps.providers,
            &crate::engine::zaps::Target::Event { id },
            e.network.now / 1000,
        );
        row["counts"]["zaps"] = json!(total.sats);
        row["counts"]["zapState"] = json!(total.phase);
        row["counts"]["zapUnverified"] = json!(total.unverified);
        row["counts"]["zapAmountMsat"] = json!(total.amount_msat);
        row["counts"]["zapLimited"] = json!(total.limited);
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

#[cfg(test)]
#[path = "counts_context_test.rs"]
mod tests;

#[cfg(test)]
#[path = "counts_selection_test.rs"]
mod selection_tests;
