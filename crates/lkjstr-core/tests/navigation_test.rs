use lkjstr_core::{
    Command, Open, View, Workspace,
    layout::{self, Zone},
    navigation::Navigation,
    route,
};

fn serialized(ws: &Workspace) -> String {
    serde_json::to_string(ws).unwrap_or_default()
}
fn single() -> Workspace {
    let mut ws = Workspace::preset(true);
    for tab in ws
        .tabs
        .keys()
        .copied()
        .filter(|t| *t != 1)
        .collect::<Vec<_>>()
    {
        ws.close_tab(tab);
    }
    ws.navigation = Navigation::default();
    ws
}
fn profile() -> View {
    View::Profile {
        pubkey: "a".repeat(64),
    }
}

#[test]
fn preview_replaces_preview_with_history_but_kept_tabs_are_independent() {
    let mut ws = single();
    let tab = ws.open_detail(profile(), 700.0, false, false);
    assert_eq!(layout::panes(&ws.root).len(), 1);
    assert!(ws.navigation.previews.contains(&tab));
    let second = ws.open_detail(View::Global, 700.0, false, false);
    assert_eq!(second, tab);
    assert!(ws.travel(-1));
    assert_eq!(ws.tabs.get(&tab), Some(&profile()));
    ws.keep(tab);
    let third = ws.open_detail(profile(), 700.0, false, false);
    assert_ne!(third, tab);
    let fourth = ws.open_detail(profile(), 700.0, true, false);
    assert_ne!(fourth, third);
    assert!(!ws.navigation.previews.contains(&fourth));
}

#[test]
fn wide_details_split_and_existing_neighbours_receive_previews() {
    let mut ws = single();
    let original = ws.focus;
    let tab = ws.open_detail(profile(), 900.0, false, false);
    assert_eq!(layout::panes(&ws.root).len(), 2);
    ws.focus = original;
    let next = ws.open_detail(View::Global, 900.0, false, false);
    assert_eq!(next, tab);
    assert_eq!(layout::panes(&ws.root).len(), 2);
}

#[test]
fn histories_are_per_tab_bounded_persisted_and_forward_branch_is_cleared() {
    let mut ws = single();
    let first = ws.focused_tab().unwrap_or(0);
    ws.navigate(first, View::Global);
    let other = ws.open(View::Home, Open::Here);
    assert!(!ws.travel(-1));
    ws.activate(first);
    assert!(ws.travel(-1));
    assert_eq!(ws.tabs.get(&first), Some(&View::Home));
    assert!(ws.travel(1));
    ws.travel(-1);
    ws.navigate(first, View::Relays);
    assert!(!ws.travel(1));
    for n in 0..100 {
        ws.navigate(
            first,
            View::Search {
                query: n.to_string(),
            },
        );
    }
    assert_eq!(ws.navigation.histories[&first].back.len(), 64);
    assert_eq!(ws.tabs.get(&other), Some(&View::Home));
    let restored: Workspace = serde_json::from_str(&serialized(&ws)).unwrap_or_else(|_| single());
    assert_eq!(restored.navigation.histories, ws.navigation.histories);
}

#[test]
fn undo_split_and_reopen_closed_tile_restore_complete_layout() {
    let mut ws = Workspace::preset(true);
    let before = ws.clone();
    ws.apply(Command::Split(Zone::Right));
    ws.undo_layout();
    assert_eq!(ws.root, before.root);
    assert_eq!(ws.tabs, before.tabs);
    assert_eq!(ws.focus, before.focus);
    ws.close_pane(10);
    ws.reopen();
    assert_eq!(ws.root, before.root);
    assert_eq!(ws.tabs, before.tabs);
    assert_eq!(ws.focus, before.focus);
}

#[test]
fn reopening_after_later_edits_preserves_new_tabs_and_draft_identity() {
    let mut ws = single();
    let closed = ws.open(View::Compose { reply_to: None }, Open::Here);
    ws.close_tab(closed);
    let later = ws.open(
        View::Search {
            query: "later".into(),
        },
        Open::Here,
    );
    ws.reopen();
    assert!(ws.tabs.contains_key(&closed));
    assert!(ws.tabs.contains_key(&later));
    assert_eq!(layout::tabs(&ws.root).len(), ws.tabs.len());
}

#[test]
fn every_view_has_a_round_trip_link_and_malformed_public_ids_are_rejected() {
    let views = lkjstr_core::launcher_choices()
        .into_iter()
        .map(|c| c.view)
        .chain([
            View::Link {
                url: "https://example.org/notes?a=1&b=2".into(),
            },
            View::Image {
                url: "https://example.org/photo.jpg".into(),
            },
            profile(),
            View::Thread {
                id: "b".repeat(64),
                relays: vec![],
            },
            View::Compose {
                reply_to: Some("c".repeat(64)),
            },
            View::Search {
                query: "日本語 & English #Rust".into(),
            },
        ]);
    for view in views {
        assert_eq!(route::decode(&route::encode(&view)), Some(view));
    }
    assert!(route::decode("invalid").is_none());
    assert!(route::decode(r#"{"kind":"profile","pubkey":"invalid"}"#).is_none());
}

#[test]
fn undo_never_reuses_a_draft_identity_for_a_new_tab() {
    let mut ws = single();
    let first = ws.open(View::Compose { reply_to: None }, Open::Here);
    ws.undo_layout();
    let second = ws.open(View::Compose { reply_to: None }, Open::Here);
    assert_ne!(first, second);
}
