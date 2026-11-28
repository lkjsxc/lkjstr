#![allow(clippy::expect_used)]
mod engine_read_union_support;
use engine_read_union_support::{NOW, R, Want, acquire, event, frames, setup};
use lkjstr_core::{
    engine::{
        protocol::{Query, Source},
        query,
    },
    store::Store,
};
use serde_json::json;

fn wants() -> (Vec<Want>, Store, String) {
    let account = event(1, 1, 1, vec![]).pubkey;
    let store = Store::new(100);
    let home = Query {
        source: Source::Global,
        account: Some(account.clone()),
        ..Default::default()
    };
    let news = Query {
        source: Source::Notifications,
        account: Some(account.clone()),
        ..Default::default()
    };
    (
        vec![
            ("home".into(), query::filter(&store, &home), home),
            (
                format!("~notifications:{account}"),
                query::filter(&store, &news),
                news,
            ),
        ],
        store,
        account,
    )
}

#[test]
fn notification_watch_shares_live_envelopes_and_rejects_traffic_after_the_last_owner_leaves() {
    let (mut wants, store, account) = wants();
    let mut n = setup(2, 1);
    let requests = acquire(&mut n, wants.clone(), &store);
    assert_eq!(
        requests.len(),
        1,
        "background heads share the existing subscription budget"
    );
    assert_eq!(requests[0].as_array().expect("REQ").len(), 4);
    let wire = &requests[0][1];
    let mut visible = wants[1].clone();
    visible.0 = "notifications".into();
    wants.push(visible);
    n.plan(wants.clone(), &store, NOW + 500);
    assert!(
        frames(&mut n).is_empty(),
        "opening Notifications reuses the live head"
    );
    wants.remove(1);
    n.plan(wants.clone(), &store, NOW + 600);
    assert!(
        frames(&mut n).is_empty(),
        "account removal does not replay a visible owner"
    );
    let reaction = event(3, NOW / 1000, 7, vec![vec!["p".into(), account]]);
    assert!(
        n.message(R, &json!(["EVENT", wire, reaction]).to_string(), NOW + 601)
            .is_some()
    );
    wants.pop();
    n.plan(wants, &store, NOW + 700);
    assert!(
        frames(&mut n).is_empty(),
        "closing the last notification owner retains the feed wire"
    );
    assert!(
        n.message(R, &json!(["EVENT", wire, reaction]).to_string(), NOW + 701)
            .is_none()
    );
    let note = event(4, NOW / 1000, 1, vec![]);
    assert!(
        n.message(R, &json!(["EVENT", wire, note]).to_string(), NOW + 702)
            .is_some()
    );
    n.plan(vec![], &store, NOW + 800);
    assert_eq!(frames(&mut n).iter().filter(|f| f[0] == "CLOSE").count(), 1);
}

#[test]
fn notification_watch_preserves_private_projection_and_exact_owner_batching_fences() {
    let (wants, mut store, _) = wants();
    let policy = event(1, 1, 10000, vec![]);
    store.insert(policy.clone(), None);
    let private = [(policy.id, vec![vec!["p".into(), "f".repeat(64)]])]
        .into_iter()
        .collect();
    let mut n = setup(2, 4);
    n.plan_with_lists(wants.clone(), &store, &private, NOW);
    n.connected(R, NOW + 1);
    n.tick(NOW + 101);
    assert_eq!(frames(&mut n).iter().filter(|f| f[0] == "REQ").count(), 2);
    let mut malformed = wants.clone();
    malformed[1].0 = format!("~notifications:{}", "a".repeat(64));
    assert_eq!(acquire(&mut setup(2, 4), malformed, &store).len(), 2);
    let mut metadata = wants;
    metadata[1].0 = "~account-discovery".into();
    assert_eq!(acquire(&mut setup(2, 4), metadata, &store).len(), 2);
}
