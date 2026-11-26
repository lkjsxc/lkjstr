#![allow(clippy::expect_used)]
use super::*;

#[test]
fn third_generation_observed_hedge_precedes_soft_route_demotion() {
    let mut engine = crate::engine::Engine::new();
    engine.input(
        crate::engine::protocol::Input::LinkHint {
            hint: Some(Hint::Thin),
        },
        NOW,
    );
    engine.input(
        crate::engine::protocol::Input::Configure {
            relays: vec![A.into(), B.into(), C.into()],
        },
        NOW,
    );
    for relay in [A, B] {
        let peer = engine.network.relays.get_mut(relay).expect("primary");
        for _ in 0..16 {
            peer.read_timing.observe(2_000);
        }
        assert_eq!(peer.read_timing.p75(), Some(2_000));
    }
    engine.input(
        crate::engine::protocol::Input::Open {
            sub: "feed".into(),
            query: Query::default(),
        },
        NOW,
    );
    engine.network.drain_effects();
    engine.network.connected(A, NOW + 10);
    engine.network.connected(B, NOW + 10);
    frames(&mut engine.network);
    assert_eq!(
        engine.network.hedge_after(engine.network.requests.values()),
        2_500
    );
    for at in [1_500, 2_499] {
        engine.tick(NOW + at);
        assert!(
            !engine
                .network
                .drain_effects()
                .iter()
                .any(|e| matches!(e, Effect::Connect(_)))
        );
    }
    engine.tick(NOW + 2_500);
    assert!(
        engine
            .network
            .drain_effects()
            .iter()
            .any(|e| matches!(e, Effect::Connect(url) if url == C))
    );
}
