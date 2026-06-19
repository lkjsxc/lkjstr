use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen(start)]
pub fn start() {
    if !is_wasm_bindgen_test_runner() {
        mount_rust_workspace_shell();
    }
}

pub fn mount_rust_workspace_shell() {
    crate::host_providers::mount_rust_workspace_shell();
}

pub fn mount_rust_workspace_shell_from_db(db_name: String) {
    crate::host_providers::mount_rust_workspace_shell_from_db(db_name);
}

pub fn mount_rust_workspace_shell_from_db_with_worker(db_name: String, worker_url: String) {
    crate::host_providers::mount_rust_workspace_shell_from_db_with_worker(db_name, worker_url);
}

pub fn mount_rust_workspace_shell_with_stats_provider(
    startup: lkjstr_app::StartupInput,
    stats_provider: lkjstr_ui::StatsProvider,
) {
    lkjstr_ui::mount_app_with_stats_provider(startup, stats_provider);
}

pub fn mount_rust_workspace_shell_with_startup(startup: lkjstr_app::StartupInput) {
    lkjstr_ui::mount_app_with_startup(startup);
}

pub fn mount_rust_workspace_shell_with_home_feed(
    startup: lkjstr_app::StartupInput,
    home_feed: lkjstr_app::HomeFeedView,
) {
    lkjstr_ui::mount_app_with_home_feed(startup, home_feed);
}

pub fn mount_rust_workspace_shell_with_home_feed_provider(
    startup: lkjstr_app::StartupInput,
    home_feed_provider: lkjstr_ui::HomeFeedProvider,
) {
    lkjstr_ui::mount_app_with_home_feed_provider(startup, home_feed_provider);
}

pub fn mount_rust_workspace_shell_with_global_feed(
    startup: lkjstr_app::StartupInput,
    global_feed: lkjstr_app::GlobalFeedView,
) {
    lkjstr_ui::mount_app_with_global_feed(startup, global_feed);
}

pub fn mount_rust_workspace_shell_with_author_context_feed_provider(
    startup: lkjstr_app::StartupInput,
    author_context_feed_provider: lkjstr_ui::AuthorContextFeedProvider,
) {
    lkjstr_ui::mount_app_with_author_context_feed_provider(startup, author_context_feed_provider);
}

pub fn mount_rust_workspace_shell_with_profile_feed(
    startup: lkjstr_app::StartupInput,
    active_account_pubkey: String,
    profile_feed: lkjstr_app::ProfileFeedView,
) {
    lkjstr_ui::mount_app_with_profile_feed(
        startup,
        active_account_pubkey,
        profile_feed,
        crate::profile_clipboard_host::profile_copy_provider(),
        lkjstr_ui::ProfileFollowProvider::unavailable(),
    );
}

pub fn mount_rust_workspace_shell_with_profile_feed_and_followees_provider(
    startup: lkjstr_app::StartupInput,
    active_account_pubkey: String,
    profile_feed: lkjstr_app::ProfileFeedView,
    followees_provider: lkjstr_ui::FolloweesProvider,
) {
    lkjstr_ui::mount_app_with_profile_feed_and_followees_provider(
        startup,
        active_account_pubkey,
        profile_feed,
        followees_provider,
        crate::profile_clipboard_host::profile_copy_provider(),
        lkjstr_ui::ProfileFollowProvider::unavailable(),
    );
}

pub fn mount_rust_workspace_shell_with_profile_feed_followees_and_user_timeline_provider(
    startup: lkjstr_app::StartupInput,
    active_account_pubkey: String,
    profile_feed: lkjstr_app::ProfileFeedView,
    followees_provider: lkjstr_ui::FolloweesProvider,
    user_timeline_provider: lkjstr_ui::UserTimelineProvider,
) {
    lkjstr_ui::mount_app_with_profile_feed_followees_and_user_timeline_provider(
        startup,
        active_account_pubkey,
        profile_feed,
        followees_provider,
        user_timeline_provider,
        crate::profile_clipboard_host::profile_copy_provider(),
        lkjstr_ui::ProfileFollowProvider::unavailable(),
    );
}

pub fn mount_rust_workspace_shell_with_profile_feed_provider(
    startup: lkjstr_app::StartupInput,
    active_account_pubkey: String,
    profile_feed_provider: lkjstr_ui::ProfileFeedProvider,
) {
    lkjstr_ui::mount_app_with_profile_feed_provider(
        startup,
        active_account_pubkey,
        profile_feed_provider,
        crate::profile_clipboard_host::profile_copy_provider(),
        lkjstr_ui::ProfileFollowProvider::unavailable(),
    );
}

fn is_wasm_bindgen_test_runner() -> bool {
    web_sys::window()
        .and_then(|window| window.location().pathname().ok())
        .is_some_and(|path| path.contains("wasm-bindgen-test"))
}
