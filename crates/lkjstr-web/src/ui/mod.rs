//! Leptos UI. The shell owns the workspace signal and global shortcuts;
//! views read the runtime through `App` and register wants while visible.

mod drag;
mod feed;
mod feed_memory;
mod feed_state;
mod keys;
mod note;
mod note_parts;
mod notify;
mod pane;
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
}

fn default_text() -> u8 {
    16
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            theme: Theme::System,
            text: default_text(),
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
    /// False while the browser tab is hidden: background work pauses.
    pub page_visible: RwSignal<bool>,
}

impl Ui {
    pub fn get() -> Ui {
        expect_context::<Ui>()
    }

    pub fn open(&self, view: View, how: Open) -> TabId {
        let narrow = self.narrow.get_untracked();
        let how = if narrow { Open::Here } else { how };
        let mut tab = 0;
        self.ws.update(|ws| tab = ws.open(view, how));
        tab
    }

    /// Opens a note's conversation beside the current tile.
    pub fn open_thread(&self, id: &str, relays: Vec<String>) {
        self.open(
            View::Thread {
                id: id.to_owned(),
                relays,
            },
            Open::Beside,
        );
    }

    pub fn open_profile(&self, pubkey: &str) {
        self.open(
            View::Profile {
                pubkey: pubkey.to_owned(),
            },
            Open::Beside,
        );
    }
}

pub fn mount() {
    leptos::mount::mount_to_body(shell::Shell);
}
