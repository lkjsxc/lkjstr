#![cfg(target_arch = "wasm32")]

use std::sync::{Arc, Mutex};

use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

use lkjstr_app::{
    FeedFragmentConfig, ProfileFeedSourceState, ProfileFeedViewInput, ProfileHeaderView,
    build_profile_feed_view, empty_feed_window,
};
use lkjstr_protocol::{ProfilePointer, encode_nprofile};
use lkjstr_relays::DemandVisibility;
use lkjstr_ui::{
    ProfileCopyProvider, ProfileCopyResult, ProfileFollowProvider, default_startup_input,
};

mod profile_copy_support;
use profile_copy_support::{click, js_error, lock, reset_shells, wait_for_text};

wasm_bindgen_test_configure!(run_in_browser);

type CopyCapture = Arc<Mutex<Option<(String, String)>>>;
type CopyCommand<'a> = (&'a str, &'a str, &'a str);
const RELAY_SETS_JSON: &str = r#"[{"id":"public-default"}]"#;

#[wasm_bindgen_test(async)]
async fn rust_profile_copy_menu_copies_profile_identifiers_through_host_provider()
-> Result<(), JsValue> {
    let copied = Arc::new(Mutex::new(None::<(String, String)>));
    open_profile_tab(copied.clone()).await?;

    wait_for_text("Copy npub").await?;
    click("[aria-label='Profile copy menu']")?;

    copy_and_assert(
        &copied,
        ("[aria-label='Copy npub']", "Copied npub", "npub"),
        "npub1rustprofile",
    )
    .await?;
    let expected = expected_nprofile()?;
    copy_and_assert(
        &copied,
        (
            "[aria-label='Copy nprofile']",
            "Copied nprofile",
            "nprofile",
        ),
        expected,
    )
    .await?;
    copy_and_assert(
        &copied,
        (
            "[aria-label='Copy follow list JSON']",
            "Copied follow list",
            "follow list",
        ),
        r#"{"kind":3}"#.to_owned(),
    )
    .await?;
    copy_and_assert(
        &copied,
        (
            "[aria-label='Copy relay sets JSON']",
            "Copied relay sets",
            "relay sets",
        ),
        RELAY_SETS_JSON,
    )
    .await?;
    Ok(())
}

async fn open_profile_tab(copied: CopyCapture) -> Result<(), JsValue> {
    reset_shells()?;
    lkjstr_ui::mount_app_with_profile_feed(
        default_startup_input(),
        "a".repeat(64),
        profile_model(),
        capture_provider(copied),
        ProfileFollowProvider::unavailable(),
    );
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("My Profile").await?;
    click("[data-testid='new-tab-option-profile']")
}

fn capture_provider(copied: CopyCapture) -> ProfileCopyProvider {
    ProfileCopyProvider::new(move |command| {
        lock(&copied).replace((command.label.clone(), command.value.clone()));
        command
            .complete
            .complete(ProfileCopyResult::copied(command.label));
    })
}

fn profile_model() -> lkjstr_app::ProfileFeedView {
    build_profile_feed_view(ProfileFeedViewInput {
        owner: "browser-profile-copy".to_owned(),
        profile_pubkey: Some("a".repeat(64)),
        profile_header: Some(profile_header()),
        source_state: ProfileFeedSourceState::Pending,
        selected_relays: vec!["wss://selected.example".to_owned()],
        profile_hint_relays: vec!["wss://selected.example".to_owned()],
        relay_sets_json: RELAY_SETS_JSON.to_owned(),
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(1_700_000_000),
        now_sec: 1_700_000_030,
        page_size: 30,
        window: empty_feed_window(1, 180),
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: Vec::new(),
    })
}

fn profile_header() -> ProfileHeaderView {
    ProfileHeaderView {
        pubkey: "a".repeat(64),
        display_name: "Rust Profile".to_owned(),
        subtitle: "rust.example".to_owned(),
        npub: "npub1rustprofile".to_owned(),
        nprofile: None,
        follow_list_json: r#"{"kind":3}"#.to_owned(),
        relay_sets_json: "[]".to_owned(),
        avatar_url: None,
        banner_url: None,
        about: None,
        website: None,
        following_label: "2 following".to_owned(),
        following_known: true,
    }
}

async fn copy_and_assert(
    copied: &CopyCapture,
    command: CopyCommand<'_>,
    value: impl Into<String>,
) -> Result<(), JsValue> {
    let (selector, status, label) = command;
    click(selector)?;
    wait_for_text(status).await?;
    assert_eq!(lock(copied).clone(), Some((label.to_owned(), value.into())));
    Ok(())
}

fn expected_nprofile() -> Result<String, JsValue> {
    encode_nprofile(&ProfilePointer {
        pubkey: "a".repeat(64),
        relays: Some(vec!["wss://selected.example".to_owned()]),
    })
    .map_err(|_| js_error("failed to encode nprofile"))
}
