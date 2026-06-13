#![doc = "Leptos UI components for lkjstr."]
mod app;
mod workspace;

pub use app::{App, AppWithStartup, default_startup_input};
#[cfg(target_arch = "wasm32")]
pub use app::{
    mount_app_with_profile_feed_and_followees_provider,
    mount_app_with_profile_feed_followees_and_user_timeline_provider,
};
pub use workspace::*;
#[cfg(target_arch = "wasm32")]
pub fn mount_app_with_profile_feed(
    startup: lkjstr_app::StartupInput,
    active_account_pubkey: String,
    profile_feed: lkjstr_app::ProfileFeedView,
    profile_copy_provider: ProfileCopyProvider,
    profile_follow_provider: ProfileFollowProvider,
) {
    leptos::mount::mount_to_body(move || {
        leptos::view! {
            <AppWithStartup
                startup=startup.clone()
                active_account_pubkey=Some(active_account_pubkey.clone())
                profile_feed=Some(profile_feed.clone())
                profile_copy_provider=profile_copy_provider.clone()
                profile_follow_provider=profile_follow_provider.clone()
            />
        }
    });
}
#[cfg(target_arch = "wasm32")]
pub fn mount_app() {
    leptos::mount::mount_to_body(App);
}

#[cfg(target_arch = "wasm32")]
pub fn mount_app_with_startup(startup: lkjstr_app::StartupInput) {
    leptos::mount::mount_to_body(move || {
        leptos::view! { <AppWithStartup startup=startup.clone() /> }
    });
}

#[cfg(target_arch = "wasm32")]
pub fn mount_app_with_home_feed(
    startup: lkjstr_app::StartupInput,
    home_feed: lkjstr_app::HomeFeedView,
) {
    leptos::mount::mount_to_body(move || {
        leptos::view! {
            <AppWithStartup startup=startup.clone() home_feed=Some(home_feed.clone()) />
        }
    });
}

#[cfg(target_arch = "wasm32")]
pub fn mount_app_with_global_feed(
    startup: lkjstr_app::StartupInput,
    global_feed: lkjstr_app::GlobalFeedView,
) {
    leptos::mount::mount_to_body(move || {
        leptos::view! {
            <AppWithStartup startup=startup.clone() global_feed=Some(global_feed.clone()) />
        }
    });
}

#[cfg(target_arch = "wasm32")]
pub fn mount_app_with_global_feed_provider(
    startup: lkjstr_app::StartupInput,
    global_feed_provider: GlobalFeedProvider,
) {
    leptos::mount::mount_to_body(move || {
        leptos::view! {
            <AppWithStartup
                startup=startup.clone()
                global_feed_provider=global_feed_provider.clone()
            />
        }
    });
}

#[cfg(target_arch = "wasm32")]
pub fn mount_app_with_notifications_feed_provider(
    startup: lkjstr_app::StartupInput,
    notifications_feed_provider: NotificationsFeedProvider,
) {
    leptos::mount::mount_to_body(move || {
        leptos::view! {
            <AppWithStartup
                startup=startup.clone()
                notifications_feed_provider=notifications_feed_provider.clone()
            />
        }
    });
}

#[cfg(target_arch = "wasm32")]
pub fn mount_app_with_profile_feed_provider(
    startup: lkjstr_app::StartupInput,
    active_account_pubkey: String,
    profile_feed_provider: ProfileFeedProvider,
    profile_copy_provider: ProfileCopyProvider,
    profile_follow_provider: ProfileFollowProvider,
) {
    leptos::mount::mount_to_body(move || {
        leptos::view! {
            <AppWithStartup
                startup=startup.clone()
                active_account_pubkey=Some(active_account_pubkey.clone())
                profile_feed_provider=profile_feed_provider.clone()
                profile_copy_provider=profile_copy_provider.clone()
                profile_follow_provider=profile_follow_provider.clone()
            />
        }
    });
}

#[cfg(target_arch = "wasm32")]
pub fn mount_app_with_thread_feed_provider(
    startup: lkjstr_app::StartupInput,
    thread_feed_provider: ThreadFeedProvider,
) {
    leptos::mount::mount_to_body(move || {
        leptos::view! {
            <AppWithStartup
                startup=startup.clone()
                thread_feed_provider=thread_feed_provider.clone()
            />
        }
    });
}

#[cfg(target_arch = "wasm32")]
pub fn mount_app_with_persistence(
    startup: lkjstr_app::StartupInput,
    persistence: WorkspacePersistence,
) {
    leptos::mount::mount_to_body(move || {
        leptos::view! {
            <AppWithStartup startup=startup.clone() persistence=persistence.clone() />
        }
    });
}

#[cfg(target_arch = "wasm32")]
pub fn mount_app_with_host(startup: lkjstr_app::StartupInput, providers: HostProviders) {
    leptos::mount::mount_to_body(move || {
        leptos::view! {
            <AppWithStartup
                startup=startup.clone()
                persistence=providers.persistence.clone()
                accounts_provider=providers.accounts.clone()
                relay_settings_provider=providers.relay_settings.clone()
                stats_provider=providers.stats.clone()
                log_provider=providers.log.clone()
                settings_provider=providers.settings.clone()
                upload_settings_provider=providers.upload_settings.clone()
                tweet_provider=providers.tweet.clone()
                home_feed_provider=providers.home_feed.clone()
                followees_provider=providers.followees.clone()
                global_feed_provider=providers.global_feed.clone()
                search_feed_provider=providers.search_feed.clone()
                notifications_feed_provider=providers.notifications_feed.clone()
                profile_feed_provider=providers.profile_feed.clone()
                profile_copy_provider=providers.profile_copy.clone()
                profile_follow_provider=providers.profile_follow.clone()
                thread_feed_provider=providers.thread_feed.clone()
                user_timeline_provider=providers.user_timeline.clone()
                active_account_pubkey=providers.active_account_pubkey.clone()
            />
        }
    });
}

/// Crate ownership marker used by repository checks and docs.
pub const CRATE_OWNER: &str = "ui";
