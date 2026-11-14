//! Click-to-load media: no source is installed before the reader presses.
use leptos::prelude::*;
#[component]
pub fn Playable(url: String, audio: bool) -> impl IntoView {
    let ui = super::Ui::get();
    let loaded = RwSignal::new(false);
    view! {
        <div class="playable" on:click=|ev| ev.stop_propagation()>
            <Show when=move || loaded.get() fallback=move || view! { <button class="load-media" on:click=move |_| loaded.set(true)>{ui.tr(if audio { "Load audio" } else { "Load video" })}</button> }>
                {if audio { view! { <audio controls src=url.clone() preload="none"/> }.into_any() } else { view! { <video class="media" controls src=url.clone() preload="none"/> }.into_any() }}
            </Show>
        </div>
    }
}

impl super::Ui {
    pub fn data_saver(&self) -> bool {
        if self.settings.get().data_saver {
            return true;
        }
        let connection = web_sys::window()
            .and_then(|w| js_sys::Reflect::get(w.navigator().as_ref(), &"connection".into()).ok());
        connection.is_some_and(|c| {
            js_sys::Reflect::get(&c, &"saveData".into())
                .ok()
                .and_then(|v| v.as_bool())
                == Some(true)
                || js_sys::Reflect::get(&c, &"effectiveType".into())
                    .ok()
                    .and_then(|v| v.as_string())
                    .is_some_and(|s| s == "slow-2g" || s == "2g")
        })
    }
}
#[component]
pub fn Picture(url: String, style: String) -> impl IntoView {
    let ui = super::Ui::get();
    let pressed = RwSignal::new(false);
    let url = StoredValue::new(url);
    let style = StoredValue::new(style);
    view! {
        <Show when=move || pressed.get() || !ui.data_saver() fallback=move || view! { <button class="media load-media" style=style.get_value() on:click=move |ev| { ev.stop_propagation(); pressed.set(true); }>{move || ui.tr("Load image")}</button> }>
            <a class="media" href=url.get_value() style=style.get_value() on:click=move |ev| { ev.prevent_default(); ev.stop_propagation(); ui.detail(lkjstr_core::View::Image { url:url.get_value() },Some(&ev)); }>
                <img src=url.get_value() alt="Image" loading="lazy" decoding="async" referrerpolicy="no-referrer"/>
            </a>
        </Show>
    }
}
