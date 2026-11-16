#![allow(clippy::unwrap_used)]
use super::common;
use common::*;
use lkjstr_core::engine::zaps::*;
use std::collections::BTreeMap;
#[test]
fn asynchronous_provider_failure_invalidates_the_next_quiet_projection_once() {
    let (store, _, target) = setup();
    let mut state = State::default();
    assert!(!state.projection_changed());
    state.tick(
        &store,
        std::slice::from_ref(&target),
        &BTreeMap::new(),
        &BTreeMap::new(),
        100,
    );
    let job = state.effects().providers.remove(0);
    assert!(state.projection_changed());
    assert!(!state.projection_changed());
    assert!(state.provider_response(&store, &job, Err(Failure::Network), 101));
    state.tick(&store, &[target], &BTreeMap::new(), &BTreeMap::new(), 101);
    assert_eq!(
        state.providers.status(&store, &key(2).public_key(), 101),
        (Phase::Failed, Some(Failure::Network))
    );
    assert!(state.projection_changed());
    assert!(!state.projection_changed());
}
