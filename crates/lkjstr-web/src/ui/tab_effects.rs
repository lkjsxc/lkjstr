//! Tab browser effects are shared by keyboard, menus and close buttons.
use super::Ui;
use leptos::prelude::*;
use lkjstr_core::{
    Command,
    layout::{self, Zone},
};

impl Ui {
    pub fn recover(&self, reopen: bool) {
        let mut current = self.ws.get_untracked();
        let restored = self
            .spaces
            .with_untracked(|s| s.recover(&mut current, reopen));
        if restored {
            self.ws.set(current);
        } else {
            self.app.update(|rt| {
                rt.notice = Some(
                    "This recovery includes a tab moved to another workspace. Return it first."
                        .into(),
                )
            });
            self.app.session_rev.update(|r| *r += 1);
        }
    }
    pub fn can_split(&self, zone: Zone) -> bool {
        let pane = self.ws.with_untracked(|ws| ws.focus);
        let rect = web_sys::window()
            .and_then(|w| w.document())
            .and_then(|d| {
                d.query_selector(&format!(".pane[data-pane=\"{pane}\"]"))
                    .ok()
                    .flatten()
            })
            .map(|e| e.get_bounding_client_rect());
        rect.is_some_and(|r| {
            lkjstr_core::sizes::can_split(
                r.width(),
                r.height(),
                matches!(zone, Zone::Left | Zone::Right),
            )
        })
    }
    pub fn command(&self, command: Command) {
        match command {
            Command::Grow(steps) => {
                if let Some(rect) = web_sys::window()
                    .and_then(|w| w.document())
                    .and_then(|d| d.query_selector(".desk").ok().flatten())
                    .map(|e| e.get_bounding_client_rect())
                {
                    let anchors = super::feed_memory::resize_anchors();
                    self.ws
                        .update(|ws| ws.grow_pixels(steps, rect.width(), rect.height()));
                    crate::host::after(0, move || super::feed_memory::keep_anchors(&anchors));
                }
                return;
            }
            Command::Split(zone) if !self.can_split(zone) => return,
            Command::MoveTab(zone)
                if !self.can_split(zone)
                    && self.ws.with_untracked(|ws| {
                        layout::neighbor(&ws.root, ws.focus, zone).is_none()
                    }) =>
            {
                return;
            }
            Command::CloseTab => {
                if let Some(tab) = self.ws.with_untracked(|ws| ws.focused_tab()) {
                    self.close_tab(tab);
                }
                return;
            }
            _ => (),
        }
        self.ws.update(|ws| ws.apply(command));
    }
    pub fn close_tab(&self, tab: u32) {
        let ui = *self;
        self.ws.update(|ws| ws.close_tab(tab));
        self.closed.set(Some((tab, false)));
        crate::host::after(0, || {
            crate::host::focus_selector(".pane.focused .tab.active")
        });
        leptos::task::spawn_local(async move {
            if ui
                .app
                .kv_get(&format!("draft:tab{tab}"))
                .await
                .is_some_and(|s| !s.is_empty())
                && ui.closed.get_untracked().is_some_and(|(id, _)| id == tab)
            {
                ui.closed.set(Some((tab, true)));
            }
        });
        crate::host::after(5000, move || {
            if ui.closed.get_untracked().is_some_and(|(id, _)| id == tab) {
                ui.closed.set(None);
            }
        });
    }
}

#[component]
pub fn ClosedTab() -> impl IntoView {
    let ui = Ui::get();
    view! {
        <Show when=move || ui.closed.get().is_some()>
            <div class="tab-undo" role="status"><span>{move || ui.tr(if ui.closed.get().is_some_and(|(_,draft)| draft) { "Tab closed. Draft kept on this device." } else { "Tab closed." })}</span><button title=move || ui.tr("Undo (Ctrl/Cmd+Shift+T)") on:click=move |_| { ui.recover(true); ui.closed.set(None); crate::host::after(0, || crate::host::focus_selector(".pane.focused .tab.active")); }>{move || ui.tr("Undo")}<kbd>{move || ui.tr("⇧⌘T")}</kbd></button></div>
        </Show>
    }
}
