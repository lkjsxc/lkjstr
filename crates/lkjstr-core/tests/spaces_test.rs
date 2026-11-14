use lkjstr_core::{Open, View, spaces::Spaces};
#[test]
fn switches_and_moves_keep_independent_views_and_identity() {
    let mut spaces = Spaces::default();
    let mut current = spaces.desks[0].clone();
    let tab = current.open(View::Global, Open::Here);
    let original = current.clone();
    current = spaces
        .switch(&current, 1)
        .unwrap_or_else(|| current.clone());
    assert_ne!(current, original);
    current.open(View::Settings, Open::Here);
    let second = current.clone();
    current = spaces
        .switch(&current, 0)
        .unwrap_or_else(|| current.clone());
    assert_eq!(current, original);
    assert!(spaces.move_tab(&mut current, tab, 1));
    assert!(!current.tabs.contains_key(&tab));
    assert_eq!(spaces.desks[1].tabs[&tab], View::Global);
    assert_eq!(spaces.desks[1].tabs.len(), second.tabs.len() + 1);
    assert!(spaces.switch(&current, 9).is_none());
}

#[test]
fn malformed_space_state_is_rejected_and_loaded_tabs_are_repaired() {
    assert!(Spaces::parse("{}", false).is_none());
    let mut spaces = Spaces {
        active: 9,
        ..Spaces::default()
    };
    assert!(Spaces::parse(&serde_json::to_string(&spaces).unwrap_or_default(), false).is_none());
    spaces.active = 0;
    spaces.desks[0].navigation.recent = vec![999, 2, 2];
    let parsed = Spaces::parse(&serde_json::to_string(&spaces).unwrap_or_default(), false);
    assert_eq!(
        parsed.map(|s| s.desks[0].navigation.recent.clone()),
        Some(vec![2])
    );
}

#[test]
fn recovery_cannot_duplicate_a_moved_tabs_draft_identity() {
    let mut spaces = Spaces::default();
    let mut current = spaces.desks[0].clone();
    let tab = current.open(View::Compose { reply_to: None }, Open::Here);
    assert!(spaces.move_tab(&mut current, tab, 1));
    let after = current.clone();
    assert!(!spaces.recover(&mut current, false));
    assert_eq!(current, after);
    assert!(spaces.desks[1].tabs.contains_key(&tab));
}
