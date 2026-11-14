//! Leptos UI. The shell owns the workspace signal and global shortcuts;
//! views read the runtime through `App` and register wants while visible.

mod drag;
mod feed;
mod feed_memory;
mod feed_source;
mod feed_state;
mod frame;
mod icons;
mod keys;
mod navigation;
mod note;
mod note_actions;
mod note_parts;
mod notify;
mod pane;
mod reference;
mod shell;
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
    #[serde(default)]
    pub language: Option<lkjstr_core::appearance::Language>,
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
            language: None,
        }
    }
}

/// UI-wide handles, provided as context. Copy.
#[derive(Clone, Copy)]
pub struct Ui {
    pub app: App,
    pub ws: RwSignal<Workspace>,
    pub settings: RwSignal<Settings>,
    pub narrow: RwSignal<bool>,
    pub help: RwSignal<bool>,
    pub palette: RwSignal<bool>,
    /// False while the browser tab is hidden: background work pauses.
    pub page_visible: RwSignal<bool>,
}

impl Ui {
    pub fn get() -> Ui {
        expect_context::<Ui>()
    }

    pub fn tr(&self, text: &str) -> String {
        let language = self.settings.with(|s| s.language).unwrap_or_else(|| {
            let languages = web_sys::window()
                .map(|w| {
                    w.navigator()
                        .languages()
                        .iter()
                        .filter_map(|v| v.as_string())
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            lkjstr_core::appearance::language(&languages)
        });
        lkjstr_core::words::text(language, text).to_owned()
    }

    pub fn open(&self, view: View, how: Open) -> TabId {
        let narrow = self.narrow.get_untracked();
        let how = if narrow { Open::Here } else { how };
        let mut tab = 0;
        self.ws.update(|ws| tab = ws.open(view, how));
        tab
    }

    pub fn detail(&self, view: View, event: Option<&web_sys::MouseEvent>) -> TabId {
        let width = web_sys::window()
            .and_then(|w| w.inner_width().ok())
            .and_then(|v| v.as_f64())
            .unwrap_or(1280.0);
        let kept = event.is_some_and(|e| e.ctrl_key() || e.meta_key());
        let split = event.is_some_and(|e| e.shift_key());
        let mut tab = 0;
        self.ws
            .update(|ws| tab = ws.open_detail(view, width, kept || split, split));
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
