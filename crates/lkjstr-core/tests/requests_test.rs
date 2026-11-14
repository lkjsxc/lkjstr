use std::collections::{BTreeSet, HashMap};

use lkjstr_core::plan::Planned;
use lkjstr_core::requests::{self, Auth, Lookup, Progress, SubState};
use lkjstr_protocol::NostrFilter;

fn planned(n: u32, relay: &str) -> Planned {
    Planned {
        relay: relay.into(),
        wants: BTreeSet::from([n]),
        live: false,
        filters: vec![NostrFilter {
            ids: Some(vec![format!("{n:064}")]),
            ..NostrFilter::default()
        }],
    }
}

#[test]
fn removal_pumps_retained_queue_after_complete_diff() {
    let mut subs = HashMap::new();
    let mut next = 0;
    let plan: Vec<_> = (0..12).map(|n| planned(n, "a")).collect();
    requests::reconcile(&mut subs, plan.clone(), &mut next);
    for key in requests::ready(&subs, "a", 10) {
        if let Some(sub) = subs.get_mut(&key) {
            sub.state = SubState::Waiting;
        }
    }
    assert!(requests::ready(&subs, "a", 10).is_empty());
    let removed = plan
        .iter()
        .find(|p| subs.get(&p.key()).is_some_and(|s| s.state.active()));
    assert!(removed.is_some());
    let retained: Vec<_> = plan
        .iter()
        .filter(|p| Some(p.key()) != removed.map(Planned::key))
        .cloned()
        .collect();
    let close = requests::reconcile(&mut subs, retained, &mut next);
    assert_eq!(close.len(), 1);
    assert_eq!(requests::ready(&subs, "a", 10).len(), 1);
    assert_eq!(next, 12, "retained requests were not recreated");
}

#[test]
fn only_accepted_auth_retries_auth_required_on_that_relay() {
    let mut subs = HashMap::new();
    requests::reconcile(
        &mut subs,
        vec![planned(1, "a"), planned(2, "a"), planned(3, "b")],
        &mut 0,
    );
    for sub in subs.values_mut() {
        sub.state = SubState::Failed("auth-required: authenticate".into());
    }
    if let Some(sub) = subs.get_mut(&planned(2, "a").key()) {
        sub.state = SubState::Failed("error: refused".into());
    }
    let mut auth = Auth {
        pending: Some("auth event".into()),
    };
    assert!(!auth.acknowledge("publication", true, "a", &mut subs));
    assert!(requests::ready(&subs, "a", 10).is_empty());
    assert!(auth.acknowledge("auth event", false, "a", &mut subs));
    assert!(requests::ready(&subs, "a", 10).is_empty());
    auth.pending = Some("new auth".into());
    assert!(auth.acknowledge("new auth", true, "a", &mut subs));
    assert_eq!(requests::ready(&subs, "a", 10), vec![planned(1, "a").key()]);
    assert!(requests::ready(&subs, "b", 10).is_empty());
}

#[test]
fn completed_and_failed_requests_do_not_keep_connections_alive() {
    let mut subs = HashMap::new();
    requests::reconcile(&mut subs, vec![planned(1, "a")], &mut 0);
    for state in [
        SubState::Queued,
        SubState::Waiting,
        SubState::Live,
        SubState::Done,
        SubState::Failed("closed".into()),
    ] {
        for sub in subs.values_mut() {
            sub.state = state.clone();
        }
        assert_eq!(
            requests::busy(&subs, "a"),
            matches!(state, SubState::Queued | SubState::Waiting | SubState::Live)
        );
    }
    assert!(requests::ready(&subs, "a", 10).is_empty());
}

#[test]
fn missing_lookup_settles_for_eose_refusal_and_mixed_results() {
    assert_eq!(Lookup::from_progress(None), Lookup::Loading);
    assert_eq!(
        Lookup::from_progress(Some(Progress::default())),
        Lookup::NoRelay
    );
    let mut p = Progress {
        total: 2,
        answered: 0,
        failed: 0,
    };
    assert_eq!(Lookup::from_progress(Some(p)), Lookup::Loading);
    p.answered = 1;
    assert_eq!(Lookup::from_progress(Some(p)), Lookup::Loading);
    p.failed = 1;
    assert_eq!(Lookup::from_progress(Some(p)), Lookup::Missing);
    p.answered = 0;
    p.failed = 2;
    assert_eq!(Lookup::from_progress(Some(p)), Lookup::Failed);
    p.answered = 2;
    p.failed = 0;
    assert_eq!(Lookup::from_progress(Some(p)), Lookup::Missing);
}
