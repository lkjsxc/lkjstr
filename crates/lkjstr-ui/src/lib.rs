#![doc = "Leptos UI components for lkjstr."]

mod app;
mod workspace;

pub use app::App;

#[cfg(target_arch = "wasm32")]
pub fn mount_app() {
    leptos::mount::mount_to_body(App);
}

/// Crate ownership marker used by repository checks and docs.
pub const CRATE_OWNER: &str = "ui";
