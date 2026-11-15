//! Restart clocks cannot erase cooldown or restore session counters.
#![allow(clippy::expect_used)]
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::Query,
    },
    store::Store,
};
use lkjstr_protocol::NostrFilter;
const R: &str = "wss://quality.test/";
fn plan(n: &mut Network, now: u64) {
    n.plan(
        vec![(
            "profile".into(),
            NostrFilter {
                kinds: Some(vec![0]),
                authors: Some(vec!["a".repeat(64)]),
                ..Default::default()
            },
            Query::default(),
        )],
        &Store::new(0),
        now,
    );
}
#[test]
fn cooldown_survives_forward_restart_rollback_and_new_profile_requests() {
    let mut n = Network::default();
    n.configure(vec![R.into()], 10000);
    plan(&mut n, 10000);
    n.connected(R, 10001);
    n.message(R, r#"["NOTICE","too many requests"]"#, 11000);
    let saved = n.quality_json(12000);
    for now in [12500, 0] {
        let mut restored = Network::default();
        restored.restore_quality(&saved, now);
        restored.configure(vec![R.into()], now);
        plan(&mut restored, now);
        restored.connected(R, now + 1);
        assert!(
            !restored
                .drain_effects()
                .iter()
                .any(|e| matches!(e, Effect::Send(_,s) if s.contains("REQ")))
        );
        assert_eq!(restored.relays[R].received, 0);
        restored.tick(now + 120001);
        restored.connected(R, now + 120002);
        assert!(
            restored
                .drain_effects()
                .iter()
                .any(|e| matches!(e, Effect::Send(_,s) if s.contains("REQ")))
        );
    }
    println!("backoff scorecard restarts=2 premature_REQs before=2 after=0 recovery=2/2");
}
#[test]
fn connection_backoff_and_age_decay_are_bounded() {
    let mut n = Network::default();
    n.configure(vec![R.into()], 0);
    n.relays.get_mut(R).expect("relay").received = 1000;
    n.disconnected(R, 100);
    let saved = n.quality_json(200);
    let mut restored = Network::default();
    restored.restore_quality(&saved, 300);
    restored.configure(vec![R.into()], 300);
    plan(&mut restored, 300);
    assert!(
        !restored
            .drain_effects()
            .iter()
            .any(|e| matches!(e, Effect::Connect(_)))
    );
    restored.tick(2200);
    assert!(
        restored
            .drain_effects()
            .iter()
            .any(|e| matches!(e, Effect::Connect(_)))
    );
    let mut old = Network::default();
    old.restore_quality(&saved, 24 * 3600000);
    old.configure(vec![R.into()], 24 * 3600000);
    assert_eq!(old.relays[R].prior_received, 0);
    assert_eq!(old.relays[R].failures, 0);
    assert_eq!(old.relays[R].quality_weight(24 * 3600000), 600);
}
#[test]
fn healthy_reload_does_not_inherit_a_connection_attempt_deadline() {
    let mut n = Network::default();
    n.configure(vec![R.into()], 1_000_000);
    plan(&mut n, 1_000_000);
    n.connected(R, 1_000_001);
    assert!(n.relays[R].retry_at > 1_000_001);
    let saved = n.quality_json(1_000_002);
    for clock in [1_000_003, 100] {
        let mut restored = Network::default();
        restored.restore_quality(&saved, clock);
        restored.configure(vec![R.into()], clock);
        plan(&mut restored, clock);
        assert!(
            restored
                .drain_effects()
                .iter()
                .any(|e| matches!(e, Effect::Connect(_)))
        );
    }
}
