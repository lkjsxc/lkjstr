#![doc = "New Tab catalog filtering."]

use crate::workspace::tab::tab_kind_key;
use crate::workspace::tab_catalog::{NewTabOption, NewTabOptionGroup, new_tab_options_for_account};

#[must_use]
pub fn normalize_new_tab_query(query: &str) -> String {
    query.trim().to_ascii_lowercase()
}

#[must_use]
pub fn new_tab_option_search_text(option: &NewTabOption) -> String {
    let aliases = option.aliases.join(" ");
    format!(
        "{} {} {} {} {}",
        option.label,
        option.description,
        group_key(option.group),
        tab_kind_key(option.kind),
        aliases
    )
    .to_ascii_lowercase()
}

#[must_use]
pub fn new_tab_option_matches(option: &NewTabOption, query: &str) -> bool {
    let normalized = normalize_new_tab_query(query);
    normalized.is_empty() || new_tab_option_search_text(option).contains(&normalized)
}

#[must_use]
pub fn filter_new_tab_options(options: &[NewTabOption], query: &str) -> Vec<NewTabOption> {
    let normalized = normalize_new_tab_query(query);
    if normalized.is_empty() {
        return options.to_vec();
    }
    options
        .iter()
        .filter(|option| new_tab_option_search_text(option).contains(&normalized))
        .cloned()
        .collect()
}

#[must_use]
pub fn new_tab_options_for_account_and_query(
    active_pubkey: Option<&str>,
    query: &str,
) -> Vec<NewTabOption> {
    filter_new_tab_options(&new_tab_options_for_account(active_pubkey), query)
}

const fn group_key(group: NewTabOptionGroup) -> &'static str {
    match group {
        NewTabOptionGroup::Primary => "primary",
        NewTabOptionGroup::Secondary => "secondary",
    }
}
