//! Bootstrap relays already used by the retained app; never opened by harnesses.
use super::*;
pub(super) fn initial_engine() -> Engine {
    let mut engine = Engine::new();
    if !cfg!(feature = "harness") {
        engine.input(
            lkjstr_core::engine::protocol::Input::Configure {
                relays: vec!["wss://nos.lol/".into(), "wss://relay.damus.io/".into()],
            },
            now(),
        );
    }
    engine
}
