#![cfg(target_arch = "wasm32")]

use std::sync::{Arc, Mutex};

use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

use lkjstr_app::{
    FeedFragmentConfig, ProfileFeedSourceState, ProfileFeedViewInput, ProfileHeaderView,
    build_profile_feed_view, empty_feed_window,
};
use lkjstr_relays::DemandVisibility;
use lkjstr_ui::{
    ProfileCopyProvider, ProfileFollowCommand, ProfileFollowProvider, ProfileFollowResult,
    default_startup_input,
};

mod accounts_selector_test_support;
mod profile_copy_support;
mod profile_follow_host_support;
use accounts_selector_test_support::{
    WORKER_URL, clear_legacy, test_db_name, wait_for_text as wait_for_host_text,
};
use profile_copy_support::{click, lock, reset_shells, wait_for_text};
use profile_follow_host_support::{
    assert_published_follow, install_accepting_websocket, restore_nip07, restore_websocket,
    seed_follow_publish, seed_nip07_follow_publish, skip_unavailable_worker,
};

wasm_bindgen_test_configure!(run_in_browser);

type CommandCapture = Arc<Mutex<Vec<String>>>;

#[wasm_bindgen_test(async)]
async fn rust_profile_follow_button_loads_and_toggles_through_provider() -> Result<(), JsValue> {
    let commands = Arc::new(Mutex::new(Vec::<String>::new()));
    open_profile_tab(capturing_provider(commands.clone())).await?;

    wait_for_text("Unfollow").await?;
    click("[aria-label='Toggle follow profile']")?;
    wait_for_text("Follow").await?;

    assert_eq!(
        lock(&commands).clone(),
        vec![format!("load:{}", pubkey("b")), "toggle:false".to_owned()]
    );
    Ok(())
}

#[wasm_bindgen_test(async)]
async fn rust_profile_follow_failure_keeps_cached_state() -> Result<(), JsValue> {
    open_profile_tab(failing_provider()).await?;

    wait_for_text("Unfollow").await?;
    click("[aria-label='Toggle follow profile']")?;
    wait_for_text("Profile follow signer rejected signing.").await?;
    wait_for_text("Unfollow").await
}

#[wasm_bindgen_test(async)]
async fn rust_profile_follow_host_publishes_local_follow_event() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    install_accepting_websocket()?;
    let db_name = test_db_name("profile-follow-publish");
    let (account_pubkey, target_pubkey) = match seed_follow_publish(&db_name).await {
        Ok(seed) => seed,
        Err(error) => return skip_unavailable_worker(error),
    };

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(
        db_name.clone(),
        WORKER_URL.to_owned(),
    );
    wait_for_host_text("Follow").await?;
    click("[aria-label='Toggle follow profile']")?;
    wait_for_host_text("Unfollow").await?;
    assert_published_follow(&db_name, &account_pubkey, &target_pubkey).await?;
    restore_websocket()
}

#[wasm_bindgen_test(async)]
async fn rust_profile_follow_host_publishes_nip07_follow_event() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    install_accepting_websocket()?;
    let db_name = test_db_name("profile-follow-nip07-publish");
    let (account_pubkey, target_pubkey) = match seed_nip07_follow_publish(&db_name).await {
        Ok(seed) => seed,
        Err(error) => return skip_unavailable_worker(error),
    };

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(
        db_name.clone(),
        WORKER_URL.to_owned(),
    );
    wait_for_host_text("Follow").await?;
    click("[aria-label='Toggle follow profile']")?;
    wait_for_host_text("Unfollow").await?;
    assert_published_follow(&db_name, &account_pubkey, &target_pubkey).await?;
    restore_nip07()?;
    restore_websocket()
}

async fn open_profile_tab(provider: ProfileFollowProvider) -> Result<(), JsValue> {
    reset_shells()?;
    lkjstr_ui::mount_app_with_profile_feed(
        default_startup_input(),
        pubkey("a"),
        profile_model(),
        ProfileCopyProvider::unavailable(),
        provider,
    );
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("My Profile").await?;
    click("[data-testid='new-tab-option-profile']")
}

fn capturing_provider(commands: CommandCapture) -> ProfileFollowProvider {
    ProfileFollowProvider::new(move |command| match command {
        ProfileFollowCommand::Load(command) => {
            lock(&commands).push(format!("load:{}", command.target_pubkey));
            command
                .complete
                .complete(ProfileFollowResult::new(true, ""));
        }
        ProfileFollowCommand::Toggle(command) => {
            lock(&commands).push(format!("toggle:{}", command.follow));
            command
                .complete
                .complete(ProfileFollowResult::new(command.follow, ""));
        }
    })
}

fn failing_provider() -> ProfileFollowProvider {
    ProfileFollowProvider::new(move |command| match command {
        ProfileFollowCommand::Load(command) => command
            .complete
            .complete(ProfileFollowResult::new(true, "")),
        ProfileFollowCommand::Toggle(command) => {
            command.complete.complete(ProfileFollowResult::new(
                command.current,
                "Profile follow signer rejected signing.",
            ));
        }
    })
}

fn profile_model() -> lkjstr_app::ProfileFeedView {
    build_profile_feed_view(ProfileFeedViewInput {
        owner: "browser-profile-follow".to_owned(),
        profile_pubkey: Some(pubkey("b")),
        profile_header: Some(profile_header()),
        source_state: ProfileFeedSourceState::Pending,
        selected_relays: vec!["wss://selected.example".to_owned()],
        profile_hint_relays: vec!["wss://selected.example".to_owned()],
        relay_sets_json: "[]".to_owned(),
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
        pubkey: pubkey("b"),
        display_name: "Rust Profile".to_owned(),
        subtitle: "rust.example".to_owned(),
        npub: "npub1rustprofile".to_owned(),
        nprofile: None,
        follow_list_json: "null".to_owned(),
        relay_sets_json: "[]".to_owned(),
        avatar_url: None,
        banner_url: None,
        about: None,
        website: None,
        following_label: "2 following".to_owned(),
        following_known: true,
    }
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}
