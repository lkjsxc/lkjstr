use lkjstr_core::{Open, View, Workspace, addresses, spaces::Spaces};

#[test]
fn reload_matches_public_identity_and_preserves_private_state_and_history() {
    for view in [
        View::Thread {
            id: "a".repeat(64),
            relays: vec!["wss://relay.example".into()],
        },
        View::Compose {
            reply_to: Some("b".repeat(64)),
        },
    ] {
        let mut ws = Workspace::preset(false);
        let tab = ws.focused_tab().unwrap_or(0);
        ws.navigate(tab, view.clone());
        let before = serde_json::to_string(&ws).unwrap_or_default();
        let public = addresses::parse(&addresses::path(&view), "").unwrap_or(View::NotFound);
        ws.restore_address(public.clone(), true);
        assert_eq!(serde_json::to_string(&ws).unwrap_or_default(), before);
        ws.restore_address(public, false);
        assert_eq!(ws.tabs.len(), Workspace::preset(false).tabs.len() + 1);
    }
}

#[test]
fn reload_does_not_match_other_ids_queries_or_unaddressed_views() {
    let mut ws = Workspace::preset(false);
    let tab = ws.focused_tab().unwrap_or(0);
    ws.navigate(
        tab,
        View::Thread {
            id: "a".repeat(64),
            relays: vec![],
        },
    );
    ws.restore_address(
        View::Thread {
            id: "b".repeat(64),
            relays: vec![],
        },
        true,
    );
    assert_ne!(ws.focused_tab(), Some(tab));
    let tab = ws.focused_tab();
    ws.restore_address(
        View::Search {
            query: "different".into(),
        },
        true,
    );
    assert_ne!(ws.focused_tab(), tab);
}

#[test]
fn travel_honors_multi_entry_jumps_zero_and_exhausted_history() {
    let mut ws = Workspace::preset(false);
    let tab = ws.open(View::Global, Open::Here);
    for n in 0..70 {
        ws.navigate(
            tab,
            View::Search {
                query: n.to_string(),
            },
        );
    }
    assert!(ws.travel(-2));
    assert_eq!(ws.tabs[&tab], View::Search { query: "67".into() });
    assert!(!ws.travel(0));
    assert!(ws.travel(2));
    assert_eq!(ws.tabs[&tab], View::Search { query: "69".into() });
    assert!(ws.travel(i32::MIN));
    assert_eq!(ws.tabs[&tab], View::Search { query: "5".into() });
    assert!(!ws.travel(-1));
    assert!(ws.travel(i32::MAX));
    assert_eq!(ws.tabs[&tab], View::Search { query: "69".into() });
}

#[test]
fn cross_desk_moves_sync_atomically_in_both_directions_and_survive_save() {
    let mut sender = Spaces::default();
    let mut receiver = sender.clone();
    receiver.active = 1;
    let mut current = sender.desks[0].clone();
    let tab = current.focused_tab().unwrap_or(0);
    current.navigate(
        tab,
        View::Compose {
            reply_to: Some("a".repeat(64)),
        },
    );
    let history = current.navigation.histories[&tab].clone();
    assert!(sender.move_tab(&mut current, tab, 1));
    sender.desks[0] = current;
    // A single-desk import would collide with the tab's old source copy.
    assert!(!receiver.install(1, sender.desks[1].clone()));
    assert!(receiver.install_desks(sender.desks.clone()));
    assert_eq!(receiver.active, 1);
    assert!(!receiver.desks[0].tabs.contains_key(&tab));
    assert_eq!(receiver.desks[1].navigation.histories[&tab], history);
    let saved = serde_json::to_string(&receiver).unwrap_or_default();
    let mut receiver = Spaces::parse(&saved, false).unwrap_or_default();
    assert!(receiver.desks[1].tabs.contains_key(&tab));
    let mut current = receiver.desks[1].clone();
    assert!(receiver.move_tab(&mut current, tab, 0));
    receiver.desks[1] = current;
    assert!(sender.install_desks(receiver.desks));
    assert!(sender.desks[0].tabs.contains_key(&tab));
    assert!(!sender.desks[1].tabs.contains_key(&tab));
    let before = serde_json::to_string(&sender).unwrap_or_default();
    let mut invalid = sender.desks.clone();
    invalid[1] = invalid[0].clone();
    assert!(!sender.install_desks(invalid));
    assert!(!sender.install_desks(vec![]));
    assert_eq!(serde_json::to_string(&sender).unwrap_or_default(), before);
}
