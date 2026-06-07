use lkjstr_domain::{LKJSXC_TIMELINE_PUBKEY, TabKind, new_tab_options_for_account};

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
        "Public Chat",
        "lkjsxc",
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
fn exposes_fixed_lkjsxc_timeline() -> Result<(), String> {
    let options = new_tab_options_for_account(None);
    let item = options
        .iter()
        .find(|option| option.label == "lkjsxc")
        .ok_or_else(|| "missing lkjsxc".to_owned())?;

    assert_eq!(item.kind, TabKind::UserTimeline);
    assert_eq!(
        item.config.get("pubkey").map(String::as_str),
        Some(LKJSXC_TIMELINE_PUBKEY)
    );
    assert!(item.aliases.contains(&"starter"));
    assert!(item.aliases.contains(&"public timeline"));
    Ok(())
}

#[test]
fn active_account_profile_inserts_after_lkjsxc() -> Result<(), String> {
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
        Some(8)
    );
    assert!(profile.aliases.contains(&"profile"));
    assert!(profile.aliases.contains(&"me"));
    Ok(())
}
