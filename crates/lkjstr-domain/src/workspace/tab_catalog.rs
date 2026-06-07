#![doc = "New Tab catalog options."]

use std::collections::BTreeMap;

use crate::workspace::tab::{TabKind, title_for};

pub const LKJSXC_TIMELINE_PUBKEY: &str =
    "0f38afb23cec30570ee64f9a4aa099229395ec3371c5fe867e09c9111480015d";

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewTabOption {
    pub kind: TabKind,
    pub label: &'static str,
    pub description: &'static str,
    pub aliases: &'static [&'static str],
    pub config: BTreeMap<String, String>,
}

#[must_use]
pub fn new_tab_options_for_account(active_pubkey: Option<&str>) -> Vec<NewTabOption> {
    let mut options = base_options();
    let Some(pubkey) = active_pubkey else {
        return options;
    };
    let profile = NewTabOption {
        kind: TabKind::Profile,
        label: "My Profile",
        description: "Active account profile.",
        aliases: &["profile", "me"],
        config: BTreeMap::from([("pubkey".to_owned(), pubkey.to_owned())]),
    };
    let insert_at = options
        .iter()
        .position(|option| option.label == "lkjsxc")
        .or_else(|| {
            options
                .iter()
                .position(|option| option.kind == TabKind::PublicChat)
        })
        .map_or(options.len(), |index| index + 1);
    options.insert(insert_at, profile);
    options
}

fn base_options() -> Vec<NewTabOption> {
    vec![
        option(
            TabKind::Timeline,
            "Account follows.",
            &["timeline", "follows"],
        ),
        option(
            TabKind::Tweet,
            "Single note draft.",
            &["note", "post", "compose"],
        ),
        option(TabKind::Notifications, "Account activity.", &[]),
        option(TabKind::Search, "Event text lookup.", &[]),
        option(TabKind::CustomRequest, "Validated relay filters.", &[]),
        option(TabKind::Global, "Relay notes.", &["firehose", "relay"]),
        option(
            TabKind::PublicChat,
            "NIP-28 channel chat.",
            &["chat", "channel", "nip28", "room", "public"],
        ),
        lkjstr_option(),
        option(TabKind::ProfileEdit, "Active account metadata.", &[]),
        option(TabKind::AccountManager, "Identity list.", &[]),
        option(TabKind::RelaySettings, "Relay sets.", &[]),
        option(TabKind::NetworkStats, "Network counters.", &[]),
        option(TabKind::Settings, "Key-value editor.", &[]),
        option(TabKind::UploadSettings, "Media upload.", &[]),
        option(
            TabKind::RelayMonitor,
            "Session diagnostics.",
            &["diagnostics", "log"],
        ),
        option(TabKind::NpubMiner, "Vanity key search.", &["vanity", "key"]),
        option(TabKind::Welcome, "Startup guide.", &[]),
    ]
}

fn option(
    kind: TabKind,
    description: &'static str,
    aliases: &'static [&'static str],
) -> NewTabOption {
    NewTabOption {
        kind,
        label: title_for(kind),
        description,
        aliases,
        config: BTreeMap::new(),
    }
}

fn lkjstr_option() -> NewTabOption {
    NewTabOption {
        kind: TabKind::UserTimeline,
        label: "lkjsxc",
        description: "Show lkjsxc's public follow-graph timeline.",
        aliases: &[
            "lkjsxc",
            "starter",
            "recommended",
            "public timeline",
            "npub1puu2",
        ],
        config: BTreeMap::from([("pubkey".to_owned(), LKJSXC_TIMELINE_PUBKEY.to_owned())]),
    }
}
