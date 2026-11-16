#![allow(clippy::unwrap_used)]
use super::common;
use common::*;
use lkjstr_core::{engine::zaps::*, store::Store};

#[test]
fn stale_profile_responses_and_removed_wants_never_restore_provider_trust() {
    let mut store = Store::new(8);
    profile(&mut store, 2, "alice@ln.test", 1);
    let mut providers = Providers::default();
    let key = key(2).public_key();
    let old = providers
        .sync(&store, std::slice::from_ref(&key), 100)
        .unwrap()
        .fetch
        .remove(0);
    profile(&mut store, 2, "alice@other.test", 2);
    let changed = providers
        .sync(&store, std::slice::from_ref(&key), 101)
        .unwrap();
    assert_eq!(changed.cancel, vec![old.token]);
    assert!(!providers.complete(&store, &old, Ok(response(&old.binding, 4)), 101));
    let new = changed.fetch.first().unwrap();
    let hidden = providers.sync(&store, &[], 102).unwrap();
    assert_eq!(hidden.cancel, vec![new.token]);
    assert!(!providers.complete(&store, new, Ok(response(&new.binding, 4)), 102));
    assert!(providers.get(&store, &key, 102).is_none());
}
#[test]
fn metadata_absence_http_failure_and_unsupported_provider_are_distinct() {
    let mut store = Store::new(8);
    let mut providers = Providers::default();
    let key = key(2).public_key();
    assert!(
        providers
            .sync(&store, std::slice::from_ref(&key), 100)
            .unwrap()
            .fetch
            .is_empty()
    );
    assert_eq!(providers.status(&store, &key, 100), (Phase::Loading, None));
    providers.metadata_finished(&key, Failure::NotFound, 101);
    assert_eq!(
        providers.status(&store, &key, 101),
        (Phase::Failed, Some(Failure::NotFound))
    );
    profile(&mut store, 2, "alice@ln.test", 1);
    let job = providers
        .sync(&store, std::slice::from_ref(&key), 102)
        .unwrap()
        .fetch
        .remove(0);
    assert!(providers.complete(&store, &job, Err(Failure::Network), 103));
    assert_eq!(
        providers.status(&store, &key, 103),
        (Phase::Failed, Some(Failure::Network))
    );
    let job = providers
        .sync(&store, std::slice::from_ref(&key), 164)
        .unwrap()
        .fetch
        .remove(0);
    let mut response = response(&job.binding, 4);
    let mut json: serde_json::Value = serde_json::from_str(&response.body).unwrap();
    json["allowsNostr"] = serde_json::json!(false);
    response.body = json.to_string();
    assert!(providers.complete(&store, &job, Ok(response), 164));
    assert_eq!(
        providers.status(&store, &key, 164),
        (Phase::Unsupported, Some(Failure::Unsupported))
    );
}
#[test]
fn discovery_concurrency_and_late_reply_deadlines_are_bounded() {
    let mut store = Store::new(32);
    let mut wanted = vec![];
    for i in 1..=12 {
        profile(&mut store, i, &format!("person{i}@ln.test"), 1);
        wanted.push(key(i).public_key());
    }
    let mut providers = Providers::default();
    let work = providers.sync(&store, &wanted, 100).unwrap();
    assert_eq!(work.fetch.len(), 4);
    assert!(
        providers
            .sync(&store, &wanted, 101)
            .unwrap()
            .fetch
            .is_empty()
    );
    let stalled = providers.sync(&store, &wanted, 115).unwrap();
    assert_eq!(stalled.cancel.len(), 4);
    assert_eq!(stalled.fetch.len(), 4);
    for old in work.fetch {
        assert!(!providers.complete(&store, &old, Ok(response(&old.binding, 4)), 115));
    }
    assert_eq!(providers.len(), 12);
    assert_eq!(providers.sync(&store, &[], 116).unwrap().cancel.len(), 4);
    assert!(providers.is_empty());
}
