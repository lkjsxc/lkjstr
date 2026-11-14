use std::collections::HashMap;

use lkjstr_core::{
    plan::Planned,
    requests::{self, Deadline, Progress, Sub, SubState},
};
use lkjstr_protocol::NostrFilter;

fn request(relay: &str, live: bool, wants: &[u32]) -> Planned {
    Planned {
        relay: relay.into(),
        filters: vec![NostrFilter::default()],
        live,
        wants: wants.iter().copied().collect(),
    }
}

fn set_state(subs: &mut HashMap<String, Sub>, planned: &Planned, state: SubState) {
    subs.get_mut(&planned.key())
        .unwrap_or_else(|| unreachable!("planned request exists"))
        .state = state;
}

#[test]
fn mixed_deadline_closes_only_unanswered_requests_and_retains_shared_answers() {
    let mut subs = HashMap::new();
    let mut next = 0;
    let live = request("healthy", true, &[1, 2]);
    let done = request("answered", false, &[1]);
    let waiting = request("silent", true, &[1]);
    let queued = request("queued", true, &[1]);
    let refused = request("refused", true, &[1]);
    requests::reconcile(
        &mut subs,
        vec![
            live.clone(),
            done.clone(),
            waiting.clone(),
            queued,
            refused.clone(),
        ],
        &mut next,
    );
    set_state(&mut subs, &live, SubState::Live);
    set_state(&mut subs, &done, SubState::Done);
    set_state(&mut subs, &waiting, SubState::Waiting);
    set_state(&mut subs, &refused, SubState::Failed("refused".into()));
    let live_id = subs[&live.key()].sub_id.clone();
    let silent_id = subs[&waiting.key()].sub_id.clone();
    let expired = Deadline::expire(&subs, 1);
    assert_eq!(
        expired.progress,
        Progress {
            total: 5,
            answered: 2,
            failed: 3
        }
    );
    // A second want still needs the same healthy request. Neither membership
    // may be lost by the merge, and the active request must keep its wire id.
    let planned = Deadline::plan(vec![request("healthy", true, &[2])], [&expired].into_iter());
    assert_eq!(
        requests::reconcile(&mut subs, planned, &mut next),
        vec![("silent".into(), silent_id)]
    );
    assert_eq!(subs.len(), 2);
    assert_eq!(subs[&live.key()].sub_id, live_id);
    assert_eq!(subs[&live.key()].planned.wants, [1, 2].into());
    assert_eq!(subs[&done.key()].state, SubState::Done);
    assert!(requests::busy(&subs, "healthy"));
    assert!(!requests::busy(&subs, "silent"));
    // Losing a socket after the deadline still permits reconnecting its live
    // stream, without resurrecting the silent relay or completed lookup.
    subs.remove(&live.key());
    let planned = Deadline::plan(vec![], [&expired].into_iter());
    assert!(requests::reconcile(&mut subs, planned, &mut next).is_empty());
    assert_eq!(subs[&live.key()].state, SubState::Queued);
    assert!(!subs.contains_key(&waiting.key()));
    assert_eq!(subs[&done.key()].state, SubState::Done);
    // Dropping the want releases even its preserved live answer.
    set_state(&mut subs, &live, SubState::Live);
    assert_eq!(requests::reconcile(&mut subs, vec![], &mut next).len(), 1);
    assert!(subs.is_empty());
}

#[test]
fn silent_deadline_cancels_all_work_and_retry_can_plan_it_afresh() {
    let mut subs = HashMap::new();
    let mut next = 0;
    let planned = request("silent", true, &[1]);
    requests::reconcile(&mut subs, vec![planned.clone()], &mut next);
    set_state(&mut subs, &planned, SubState::Waiting);
    let expired = Deadline::expire(&subs, 1);
    assert_eq!(
        expired.progress,
        Progress {
            total: 1,
            answered: 0,
            failed: 1
        }
    );
    let plan = Deadline::plan(vec![], [&expired].into_iter());
    assert_eq!(requests::reconcile(&mut subs, plan, &mut next).len(), 1);
    assert!(subs.is_empty());
    requests::reconcile(&mut subs, vec![planned.clone()], &mut next);
    assert_eq!(subs[&planned.key()].state, SubState::Queued);
    assert_eq!(next, 2);
}

#[test]
fn explicit_retry_requeues_completed_and_unanswered_work_but_keeps_live_streams() {
    let mut subs = HashMap::new();
    let mut next = 0;
    let live = request("live", true, &[1, 2]);
    let done = request("done", false, &[1, 2]);
    let waiting = request("waiting", false, &[1]);
    let queued = request("queued", false, &[1]);
    let failed = request("failed", false, &[1]);
    let unrelated = request("unrelated", false, &[2]);
    let planned = vec![
        live.clone(),
        done.clone(),
        waiting.clone(),
        queued.clone(),
        failed.clone(),
        unrelated.clone(),
    ];
    requests::reconcile(&mut subs, planned.clone(), &mut next);
    set_state(&mut subs, &live, SubState::Live);
    set_state(&mut subs, &done, SubState::Done);
    set_state(&mut subs, &waiting, SubState::Waiting);
    set_state(&mut subs, &failed, SubState::Failed("refused".into()));
    set_state(&mut subs, &unrelated, SubState::Done);
    let old_ids: HashMap<_, _> = subs
        .iter()
        .map(|(k, s)| (k.clone(), s.sub_id.clone()))
        .collect();
    assert_eq!(
        requests::retry(&mut subs, 1),
        vec![("waiting".into(), old_ids[&waiting.key()].clone())]
    );
    assert_eq!(subs.len(), 2);
    requests::reconcile(&mut subs, planned, &mut next);
    for p in [done, waiting, queued, failed] {
        assert_eq!(subs[&p.key()].state, SubState::Queued);
        assert_ne!(subs[&p.key()].sub_id, old_ids[&p.key()]);
    }
    assert_eq!(subs[&live.key()].state, SubState::Live);
    assert_eq!(subs[&live.key()].sub_id, old_ids[&live.key()]);
    assert_eq!(subs[&live.key()].planned.wants, [1, 2].into());
    assert_eq!(subs[&unrelated.key()].state, SubState::Done);
    assert_eq!(subs[&unrelated.key()].sub_id, old_ids[&unrelated.key()]);
}
