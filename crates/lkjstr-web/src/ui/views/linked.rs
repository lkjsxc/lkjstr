//! Linked targets stay in the desk. Websites retain their own browser context.
use crate::ui::Ui;
use leptos::prelude::*;

#[component]
pub fn Website(url: String) -> impl IntoView {
    let ui = Ui::get();
    view! {
        <div class="page prose">
            <h2>{move || ui.tr("Website")}</h2>
            <p>{url.clone()}</p>
            <p class="muted">{move || ui.tr("This website opens in a browser tab.")}</p>
            <a href=url target="_blank" rel="noopener noreferrer nofollow">{move || ui.tr("Open website")}</a>
        </div>
    }
}

#[component]
pub fn Image(url: String) -> impl IntoView {
    let ui = Ui::get();
    let failed = RwSignal::new(false);
    let loading = RwSignal::new(true);
    let retry = RwSignal::new(0u32);
    let timer = StoredValue::new(None::<TimeoutHandle>);
    Effect::new(move |_| {
        retry.track();
        if let Some(old) = timer.get_value() {
            old.clear();
        }
        failed.set(false);
        loading.set(true);
        timer.set_value(
            set_timeout_with_handle(
                move || {
                    if loading.get_untracked() {
                        failed.set(true);
                        loading.set(false);
                    }
                },
                std::time::Duration::from_secs(12),
            )
            .ok(),
        );
    });
    on_cleanup(move || {
        if let Some(timer) = timer.get_value() {
            timer.clear();
        }
    });
    view! {
        <div class="page image-page">
            <Show when=move || failed.get()>
                <p class="error" role="status">{move || ui.tr("Image did not load.")}</p>
                <button on:click=move |_| retry.update(|n| *n += 1)>{move || ui.tr("Try again")}</button>
            </Show>
            {move || { retry.track(); view! {
                <img class="image-target" src=url.clone() alt="Image" referrerpolicy="no-referrer" hidden=move || failed.get() on:load=move |_| loading.set(false) on:error=move |_| { loading.set(false); failed.set(true); }/>
            } }}
        </div>
    }
}
