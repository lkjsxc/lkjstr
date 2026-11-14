#![doc = "lkjstr browser app: Leptos UI and thin host adapters over lkjstr-core."]

pub mod host;
pub mod runtime;
pub mod ui;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn start() {
    ui::mount();
}
