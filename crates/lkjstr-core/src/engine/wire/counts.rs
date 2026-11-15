//! A retained positive observation is a lower bound, never a global total.
use crate::{
    engine::{Engine, rows::Row},
    store::Query,
};
use serde_json::{Value, json};
fn estimate(value: usize, exact: bool) -> (i64, Value) {
    if exact {
        (value as i64, json!({"state":"exact","value":value}))
    } else if value > 0 {
        (value as i64, json!({"state":"at-least","value":value}))
    } else {
        // Keep existing renderers and optimistic increments compatible.
        (0, json!({"state":"unknown"}))
    }
}
pub(super) fn note(row: &Row) -> Value {
    let (replies, r) = estimate(row.counts.replies, false);
    let (reposts, p) = estimate(row.counts.reposts, false);
    let (reactions, a) = estimate(row.counts.reactions, false);
    // Trusted LNURL-provider validation is not integrated: no claimed zap total.
    let (zaps, z) = estimate(0, false);
    json!({"replies":replies,"reposts":reposts,"reactions":reactions,"zaps":zaps,
        "partial":true,"estimates":{"replies":r,"reposts":p,"reactions":a,"zaps":z}})
}
pub(super) fn profile(result: &mut Value, e: &Engine, p: &str) {
    let follows = e.store.follows(p);
    let absent = e.network.list_loaded(&e.store, p, 3);
    let (following, f) = estimate(
        follows.as_ref().map_or(0, Vec::len),
        follows.is_some() || absent,
    );
    let (followers, r) = estimate(
        e.store
            .feed(&Query {
                kinds: vec![3],
                mention: Some(p.into()),
                limit: 6000,
                ..Default::default()
            })
            .len(),
        false,
    );
    let (notes, n) = estimate(
        e.store
            .feed(&Query {
                kinds: vec![1],
                authors: Some([p.into()].into_iter().collect()),
                limit: 6000,
                ..Default::default()
            })
            .len(),
        false,
    );
    result["following"] = json!(following);
    result["followers"] = json!(followers);
    result["notes"] = json!(notes);
    result["countEstimates"] = json!({"following":f,"followers":r,"notes":n});
}
