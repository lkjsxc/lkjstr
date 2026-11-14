//! Fold rendered text at a whole-line boundary, measuring actual overflow.
use leptos::prelude::*;
use wasm_bindgen::{JsCast, closure::Closure};
#[component]
pub fn Folded(children: Children) -> impl IntoView {
    let ui = super::Ui::get();
    let expanded = RwSignal::new(false);
    let overflow = RwSignal::new(false);
    let text = NodeRef::<leptos::html::Div>::new();
    Effect::new(move |_| {
        let Some(element) = text.get() else {
            return;
        };
        let alive = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true));
        let active = alive.clone();
        let callback = Closure::<dyn FnMut()>::new(move || {
            if !active.load(std::sync::atomic::Ordering::Relaxed) {
                return;
            }
            if !expanded.get_untracked()
                && let Some(el) = text.get_untracked()
            {
                overflow.set(el.scroll_height() > el.client_height() + 1);
            }
        });
        if let Ok(observer) = web_sys::ResizeObserver::new(callback.as_ref().unchecked_ref()) {
            observer.observe(&element);
            let keep = send_wrapper::SendWrapper::new((observer, callback));
            on_cleanup(move || {
                alive.store(false, std::sync::atomic::Ordering::Relaxed);
                let (observer, _callback) = keep.take();
                observer.disconnect();
            });
        }
    });
    view! {
        <div class="reading-text" node_ref=text class:folded=move || !expanded.get()>{children()}</div>
        <Show when=move || overflow.get()>
            <button class="fold-toggle link" aria-expanded=move || expanded.get().to_string() on:click=move |ev| { ev.stop_propagation(); expanded.update(|v| *v = !*v); }>{move || ui.tr(if expanded.get() { "Show less" } else { "Show more" })}</button>
        </Show>
    }
}
