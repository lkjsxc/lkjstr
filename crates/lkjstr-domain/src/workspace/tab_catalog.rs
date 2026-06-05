#![doc = "New Tab catalog options."]

use std::collections::BTreeMap;

use crate::workspace::tab::{TabKind, title_for};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NewTabOptionGroup {
    Primary,
    Secondary,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewTabOption {
    pub kind: TabKind,
    pub label: &'static str,
    pub description: &'static str,
    pub group: NewTabOptionGroup,
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
        group: NewTabOptionGroup::Primary,
        aliases: &["profile", "me"],
        config: BTreeMap::from([("pubkey".to_owned(), pubkey.to_owned())]),
    };
    let insert_at = options
        .iter()
        .position(|option| option.kind == TabKind::Global)
        .map_or(options.len(), |index| index + 1);
    options.insert(insert_at, profile);
    options
}

fn base_options() -> Vec<NewTabOption> {
    vec![
        option(
            TabKind::Timeline,
            "Account follows.",
            NewTabOptionGroup::Primary,
            &["timeline", "follows"],
        ),
        option(
            TabKind::Tweet,
            "Single note draft.",
            NewTabOptionGroup::Primary,
            &["note", "post", "compose"],
        ),
        option(
            TabKind::Notifications,
            "Account activity.",
            NewTabOptionGroup::Primary,
            &[],
        ),
        option(
            TabKind::Search,
            "Event text lookup.",
            NewTabOptionGroup::Primary,
            &[],
        ),
        option(
            TabKind::CustomRequest,
            "Validated relay filters.",
            NewTabOptionGroup::Primary,
            &[],
        ),
        option(
            TabKind::Global,
            "Relay notes.",
            NewTabOptionGroup::Primary,
            &["firehose", "relay"],
        ),
        option(
            TabKind::ProfileEdit,
            "Active account metadata.",
            NewTabOptionGroup::Primary,
            &[],
        ),
        option(
            TabKind::AccountManager,
            "Identity list.",
            NewTabOptionGroup::Primary,
            &[],
        ),
        option(
            TabKind::RelaySettings,
            "Relay sets.",
            NewTabOptionGroup::Primary,
            &[],
        ),
        option(
            TabKind::NetworkStats,
            "Network counters.",
            NewTabOptionGroup::Primary,
            &[],
        ),
        option(
            TabKind::Settings,
            "Key-value editor.",
            NewTabOptionGroup::Secondary,
            &[],
        ),
        option(
            TabKind::UploadSettings,
            "Media upload.",
            NewTabOptionGroup::Secondary,
            &[],
        ),
        option(
            TabKind::RelayMonitor,
            "Session diagnostics.",
            NewTabOptionGroup::Secondary,
            &["diagnostics", "log"],
        ),
        option(
            TabKind::NpubMiner,
            "Vanity key search.",
            NewTabOptionGroup::Secondary,
            &["vanity", "key"],
        ),
        option(
            TabKind::Welcome,
            "Startup guide.",
            NewTabOptionGroup::Secondary,
            &[],
        ),
    ]
}

fn option(
    kind: TabKind,
    description: &'static str,
    group: NewTabOptionGroup,
    aliases: &'static [&'static str],
) -> NewTabOption {
    NewTabOption {
        kind,
        label: title_for(kind),
        description,
        group,
        aliases,
        config: BTreeMap::new(),
    }
}
