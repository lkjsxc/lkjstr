//! What a tab shows. Views are plain data so layouts persist as JSON.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum View {
    /// The `+` page: choose what this tab becomes.
    Launcher,
    Welcome,
    Home,
    Global,
    Notifications,
    Thread {
        id: String,
        #[serde(default)]
        relays: Vec<String>,
    },
    Profile {
        pubkey: String,
    },
    Search {
        #[serde(default)]
        query: String,
    },
    Compose {
        #[serde(default)]
        reply_to: Option<String>,
    },
    Relays,
    Accounts,
    Settings,
}

/// One entry of the launcher list.
pub struct LauncherChoice {
    pub view: View,
    pub title: &'static str,
    pub hint: &'static str,
}

impl View {
    /// Short title for tab strips; profiles and threads get names from the UI.
    pub fn title(&self) -> &'static str {
        match self {
            View::Launcher => "New tab",
            View::Welcome => "Welcome",
            View::Home => "Home",
            View::Global => "Global",
            View::Notifications => "Notifications",
            View::Thread { .. } => "Thread",
            View::Profile { .. } => "Profile",
            View::Search { .. } => "Search",
            View::Compose { reply_to: None } => "Compose",
            View::Compose { reply_to: Some(_) } => "Reply",
            View::Relays => "Relays",
            View::Accounts => "Accounts",
            View::Settings => "Settings",
        }
    }

    /// Singleton views are focused instead of opened twice.
    pub fn is_singleton(&self) -> bool {
        matches!(
            self,
            View::Welcome
                | View::Home
                | View::Global
                | View::Notifications
                | View::Relays
                | View::Accounts
                | View::Settings
        )
    }

    /// Views that are opened "beside" the current one (details of a note or person).
    pub fn is_detail(&self) -> bool {
        matches!(
            self,
            View::Thread { .. } | View::Profile { .. } | View::Compose { reply_to: Some(_) }
        )
    }
}

pub fn launcher_choices() -> Vec<LauncherChoice> {
    vec![
        choice(View::Home, "Home", "Notes from people you follow"),
        choice(View::Global, "Global", "Everything your relays carry"),
        choice(
            View::Notifications,
            "Notifications",
            "Replies, mentions, reactions",
        ),
        choice(
            View::Search {
                query: String::new(),
            },
            "Search",
            "Find notes and people",
        ),
        choice(View::Compose { reply_to: None }, "Compose", "Write a note"),
        choice(View::Relays, "Relays", "Connections and relay lists"),
        choice(View::Accounts, "Accounts", "Keys and signers"),
        choice(View::Settings, "Settings", "Theme and reading"),
        choice(View::Welcome, "Welcome", "Getting started and shortcuts"),
    ]
}

fn choice(view: View, title: &'static str, hint: &'static str) -> LauncherChoice {
    LauncherChoice { view, title, hint }
}
