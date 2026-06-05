use lkjstr_domain::{
    TabKind, filter_new_tab_options, new_tab_option_matches, new_tab_options_for_account,
    new_tab_options_for_account_and_query,
};

fn labels(options: &[lkjstr_domain::NewTabOption]) -> Vec<&'static str> {
    options.iter().map(|option| option.label).collect()
}

fn canonical_labels() -> Vec<&'static str> {
    vec![
        "Home",
        "Tweet",
        "Notifications",
        "Search",
        "Custom Request",
        "Global",
        "Profile Edit",
        "Accounts",
        "Relay Settings",
        "Stats",
        "Settings",
        "Upload Settings",
        "lkjstr Log",
        "Mine npub",
        "Welcome",
    ]
}

#[test]
fn exposes_direct_workspace_choices() {
    assert_eq!(
        labels(&new_tab_options_for_account(None)),
        canonical_labels()
    );
}

#[test]
fn empty_query_preserves_current_order() {
    let options = new_tab_options_for_account(None);
    assert_eq!(
        labels(&filter_new_tab_options(&options, "  ")),
        canonical_labels()
    );
}

#[test]
fn filters_by_label() {
    assert_eq!(
        labels(&new_tab_options_for_account_and_query(None, "tweet")),
        vec!["Tweet"]
    );
}

#[test]
fn filters_by_description() {
    assert_eq!(
        labels(&new_tab_options_for_account_and_query(None, "identity")),
        vec!["Accounts"]
    );
}

#[test]
fn filters_by_alias() {
    assert_eq!(
        labels(&new_tab_options_for_account_and_query(None, "compose")),
        vec!["Tweet"]
    );
    assert_eq!(
        labels(&new_tab_options_for_account_and_query(None, "firehose")),
        vec!["Global"]
    );
}

#[test]
fn filters_by_tab_kind_key() {
    assert_eq!(
        labels(&new_tab_options_for_account_and_query(
            None,
            "network-stats"
        )),
        vec!["Stats"]
    );
}

#[test]
fn filtering_trims_and_ignores_case() {
    assert_eq!(
        labels(&new_tab_options_for_account_and_query(None, "  MeDiA  ")),
        vec!["Upload Settings"]
    );
}

#[test]
fn active_account_profile_remains_filterable() -> Result<(), String> {
    let options = new_tab_options_for_account(Some("abc"));
    let profile = options
        .iter()
        .find(|option| option.label == "My Profile")
        .ok_or_else(|| "missing My Profile".to_owned())?;

    assert_eq!(profile.kind, TabKind::Profile);
    assert_eq!(
        profile.config.get("pubkey").map(String::as_str),
        Some("abc")
    );
    assert_eq!(
        options
            .iter()
            .position(|option| option.label == "My Profile"),
        Some(6)
    );
    assert!(new_tab_option_matches(profile, "profile"));
    assert!(new_tab_option_matches(profile, "me"));
    assert_eq!(
        labels(&new_tab_options_for_account_and_query(
            Some("abc"),
            "my profile"
        )),
        vec!["My Profile"]
    );
    Ok(())
}

#[test]
fn no_results_returns_empty_list() {
    assert!(new_tab_options_for_account_and_query(None, "zzz-not-found").is_empty());
}
