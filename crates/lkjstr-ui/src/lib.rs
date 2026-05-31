#![doc = "Leptos UI components for lkjstr."]

mod app;
mod workspace;

pub use app::{App, AppWithStartup, default_startup_input};
pub use workspace::{StatsComplete, StatsProvider, WorkspacePersistence};

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
pub fn mount_app_with_host(
    startup: lkjstr_app::StartupInput,
    persistence: WorkspacePersistence,
    stats_provider: StatsProvider,
) {
    leptos::mount::mount_to_body(move || {
        leptos::view! {
            <AppWithStartup
                startup=startup.clone()
                persistence=persistence.clone()
                stats_provider=stats_provider.clone()
            />
        }
    });
}

/// Crate ownership marker used by repository checks and docs.
pub const CRATE_OWNER: &str = "ui";
