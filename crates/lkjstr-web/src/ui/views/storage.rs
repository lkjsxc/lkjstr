//! Storage status belongs with device settings, independent of first-run hints.
use crate::{runtime::Storage, ui::Ui};
use leptos::prelude::*;

#[component]
pub fn StorageStatus() -> impl IntoView {
    let ui = Ui::get();
    let state = Memo::new(move |_| {
        ui.app.rev.track();
        ui.app.with(|rt| rt.storage.clone())
    });
    view! { <fieldset class="storage-state"><legend>{move || ui.tr("Data")}</legend>
        <p role="status">{move || match state.get() {
            Storage::Opening => ui.tr("Opening local storage…"),
            Storage::Ready { loaded } => ui.fmt("Local storage ready · {0} notes and profiles cached on this device.", &[&loaded.to_string()]),
            Storage::WriteFailed(reason) => ui.fmt("Local storage write failed ({0}). Event writes retry while this page is open.", &[&reason]),
            Storage::Unavailable(reason) => ui.fmt("Local storage unavailable ({0}). Nothing will persist after reload.", &[&reason]),
        }}</p>
        <Show when=move || matches!(state.get(), Storage::Unavailable(_))>
            <button on:click=move |_| { if let Some(window)=web_sys::window() { let _=window.location().reload(); } }>{move || ui.tr("Retry storage")}</button>
        </Show>
    </fieldset> }
}
