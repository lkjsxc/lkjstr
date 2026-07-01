use crate::home_feed_relay_input::{
    HomeRelayCommand, HomeRelayInputSeed, home_relay_input,
};
use lkjstr_app::{
    FeedDiagnosticSeverity, HomeFeedDiagnosticInput, HomeFeedSourceState, HomeFollowState,
    empty_feed_window,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::wasm_bindgen_test;

static PENDING_SOURCE: HomeFeedSourceState = HomeFeedSourceState::Pending;

#[wasm_bindgen_test]
fn loading_follows_plans_follow_read_without_self_only_notes() -> Result<(), JsValue> {
    let active_pubkey = Some(pubkey("a"));
    let follow_state = HomeFollowState::Loading;
    let selected_relays = vec!["wss://selected.example".to_owned()];
    let window = empty_feed_window(1, 180);
    let command = home_relay_input(seed(
        &active_pubkey,
        &follow_state,
        &selected_relays,
        &window,
        &[],
    ));
    match command {
        Some(HomeRelayCommand::Follow(input)) => {
            assert_eq!(input.active_pubkey, pubkey("a"));
            assert_eq!(input.selected_relays, vec!["wss://selected.example"]);
            Ok(())
        }
        Some(HomeRelayCommand::Notes(_)) => Err(js_error("must not scan notes before follows")),
        None => Err(js_error("expected follow discovery command")),
    }
}

#[wasm_bindgen_test]
fn loaded_follows_plans_notes_with_real_follow_authors() -> Result<(), JsValue> {
    let active_pubkey = Some(pubkey("a"));
    let follow_state = HomeFollowState::Loaded {
        follow_pubkeys: vec![pubkey("b")],
    };
    let selected_relays = vec!["wss://selected.example".to_owned()];
    let window = empty_feed_window(1, 180);
    let command = home_relay_input(seed(
        &active_pubkey,
        &follow_state,
        &selected_relays,
        &window,
        &[],
    ));
    match command {
        Some(HomeRelayCommand::Notes(input)) => {
            assert_eq!(input.active_pubkey, pubkey("a"));
            assert_eq!(input.follow_pubkeys, vec![pubkey("b")]);
            Ok(())
        }
        Some(HomeRelayCommand::Follow(_)) => Err(js_error("loaded follows should scan notes")),
        None => Err(js_error("expected notes command")),
    }
}

#[wasm_bindgen_test]
fn cache_unavailable_loading_plans_follow_read_with_diagnostic() -> Result<(), JsValue> {
    let active_pubkey = Some(pubkey("a"));
    let follow_state = HomeFollowState::Loading;
    let selected_relays = vec!["wss://selected.example".to_owned()];
    let window = empty_feed_window(1, 180);
    let diagnostics = vec![cache_unavailable_diagnostic()];
    let command = home_relay_input(seed(
        &active_pubkey,
        &follow_state,
        &selected_relays,
        &window,
        &diagnostics,
    ));
    match command {
        Some(HomeRelayCommand::Follow(input)) => {
            assert_eq!(input.selected_relays, vec!["wss://selected.example"]);
            assert_eq!(input.diagnostics, diagnostics);
            Ok(())
        }
        Some(HomeRelayCommand::Notes(_)) => Err(js_error("cache failure must not scan notes")),
        None => Err(js_error("cache failure should keep follow discovery alive")),
    }
}

fn seed<'a>(
    active_pubkey: &'a Option<String>,
    follow_state: &'a HomeFollowState,
    selected_relays: &'a [String],
    window: &'a lkjstr_app::FeedWindowState,
    diagnostics: &'a [HomeFeedDiagnosticInput],
) -> HomeRelayInputSeed<'a> {
    HomeRelayInputSeed {
        owner: "tab-a",
        active_pubkey,
        follow_state,
        source_state: &PENDING_SOURCE,
        selected_relays,
        window,
        geometry_models: &[],
        diagnostics,
        now_sec: 10,
    }
}

fn cache_unavailable_diagnostic() -> HomeFeedDiagnosticInput {
    HomeFeedDiagnosticInput {
        scope: "home-provider".to_owned(),
        id: "follow-list-cache".to_owned(),
        severity: FeedDiagnosticSeverity::Warning,
        message: "Follow list cache unavailable: busy".to_owned(),
    }
}

fn pubkey(prefix: &str) -> String {
    prefix.repeat(64)
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
