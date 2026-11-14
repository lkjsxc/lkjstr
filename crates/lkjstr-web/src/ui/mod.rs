//! Leptos UI. The shell owns the workspace signal and global shortcuts;
//! views read the runtime through `App` and register wants while visible.

mod drag;
mod feed;
mod feed_memory;
mod feed_source;
mod feed_state;
mod focus;
mod fold;
mod frame;
mod icons;
mod keys;
mod language;
mod media;
mod names;
mod navigation;
mod note;
mod note_actions;
mod note_parts;
mod notify;
mod pane;
mod reference;
mod shell;
mod spaces;
mod tab_effects;
mod tab_menu;
mod text;
mod tiles;
mod views;

use leptos::prelude::*;
use lkjstr_core::layout::TabId;
use lkjstr_core::{Open, View, Workspace};
use serde::{Deserialize, Serialize};

use crate::runtime::App;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    System,
    Light,
    Dark,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Settings {
    #[serde(default)]
    pub theme: Theme,
    #[serde(default = "default_text")]
    pub text: u8,
    #[serde(default)]
    pub compact: bool,
    #[serde(default = "enabled")]
    pub middle_close: bool,
    #[serde(default)]
    pub tab_width: u16,
    #[serde(default = "default_scale")]
    pub scale: u16,
    #[serde(default)]
    pub data_saver: bool,
    #[serde(default)]
    pub welcome_dismissed: bool,
    #[serde(default)]
    pub language: Option<lkjstr_core::appearance::Language>,
}

fn enabled() -> bool {
    true
}
fn default_scale() -> u16 {
    100
}

fn default_text() -> u8 {
    16
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            theme: Theme::System,
            text: default_text(),
            compact: false,
            middle_close: true,
            tab_width: 0,
            scale: 100,
            data_saver: false,
            welcome_dismissed: false,
            language: None,
        }
    }
}

/// UI-wide handles, provided as context. Copy.
#[derive(Clone, Copy)]
pub struct Ui {
    pub app: App,
    pub now: RwSignal<u64>,
    pub online: RwSignal<bool>,
    pub ws: RwSignal<Workspace>,
    pub spaces: RwSignal<lkjstr_core::spaces::Spaces>,
    pub settings: RwSignal<Settings>,
    pub narrow: RwSignal<bool>,
    pub help: RwSignal<bool>,
    pub zoom: RwSignal<Option<u32>>,
    pub closed: RwSignal<Option<(u32, bool)>>,
    pub palette: RwSignal<bool>,
    /// False while the browser tab is hidden: background work pauses.
    pub page_visible: RwSignal<bool>,
}

impl Ui {
    pub fn get() -> Ui {
        expect_context::<Ui>()
    }

    pub fn open(&self, view: View, how: Open) -> TabId {
        let narrow = self.narrow.get_untracked();
        let how = if narrow
            || (how != Open::Here
                && !self.can_split(lkjstr_core::layout::Zone::Right)
                && (how == Open::Split
                    || self.ws.with_untracked(|ws| {
                        lkjstr_core::layout::neighbor(
                            &ws.root,
                            ws.focus,
                            lkjstr_core::layout::Zone::Right,
                        )
                        .is_none()
                    })))
        {
            Open::Here
        } else {
            how
        };
        let mut tab = 0;
        self.ws.update(|ws| tab = ws.open(view, how));
        crate::host::after(0, || {
            crate::host::focus_selector(".pane.focused .tab.active")
        });
        tab
    }

    pub fn detail(&self, view: View, event: Option<&web_sys::MouseEvent>) -> TabId {
        let width = web_sys::window()
            .and_then(|w| w.inner_width().ok())
            .and_then(|v| v.as_f64())
            .unwrap_or(1280.0);
        let background = event.is_some_and(|e| e.button() == 1);
        let kept = background || event.is_some_and(|e| e.ctrl_key() || e.meta_key());
        let split = event.is_some_and(|e| e.shift_key());
        let mut tab = 0;
        self.ws.update(|ws| {
            let focus = ws.focus;
            let active: Vec<_> = lkjstr_core::layout::panes(&ws.root)
                .iter()
                .map(|p| p.active)
                .collect();
            tab = ws.open_detail(view, width, kept || split, split);
            if background {
                for tab in active {
                    ws.root = lkjstr_core::layout::activate(ws.root.clone(), tab);
                }
                ws.focus = focus;
            }
        });
        if !background {
            crate::host::after(0, || {
                crate::host::focus_selector(".pane.focused .tab.active")
            });
        }
        tab
    }

    pub fn open_thread(&self, id: &str, relays: Vec<String>) {
        self.detail(
            View::Thread {
                id: id.to_owned(),
                relays,
            },
            None,
        );
    }

    pub fn open_profile(&self, pubkey: &str) {
        self.detail(
            View::Profile {
                pubkey: pubkey.to_owned(),
            },
            None,
        );
    }
}

pub fn mount() {
    leptos::mount::mount_to_body(shell::Shell);
}
