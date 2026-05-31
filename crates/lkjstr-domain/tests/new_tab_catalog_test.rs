use lkjstr_domain::{TabKind, new_tab_options_for_account};

#[test]
fn exposes_direct_workspace_choices() {
    let labels: Vec<&str> = new_tab_options_for_account(None)
        .iter()
        .map(|option| option.label)
        .collect();

    assert_eq!(
        labels,
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
    );
}

#[test]
fn inserts_my_profile_after_global_for_active_account() -> Result<(), String> {
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
    Ok(())
}
