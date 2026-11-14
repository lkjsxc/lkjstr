use lkjstr_core::layout::{self, Node, Zone};
use lkjstr_core::{Command, Open, View, Workspace};

fn pane_count(ws: &Workspace) -> usize {
    layout::panes(&ws.root).len()
}

#[test]
fn preset_has_three_columns_and_valid_focus() {
    let ws = Workspace::preset(true);
    assert_eq!(pane_count(&ws), 4);
    assert_eq!(ws.focused_tab(), Some(1));
    assert_eq!(ws.tabs.get(&1), Some(&View::Home));
    let fresh = Workspace::preset(false);
    assert_eq!(
        fresh.tabs.get(&fresh.focused_tab().unwrap_or(0)),
        Some(&View::Welcome)
    );
}

#[test]
fn open_beside_reuses_right_neighbor_and_singletons_refocus() {
    let mut ws = Workspace::preset(true);
    let thread = View::Thread {
        id: "a".repeat(64),
        relays: vec![],
    };
    let tab = ws.open(thread.clone(), Open::Beside);
    let holder = layout::pane_of_tab(&ws.root, tab).map(|p| p.id);
    assert_eq!(holder, Some(11), "detail opens in the next column");
    assert_eq!(ws.focus, 11);
    assert_eq!(
        ws.open(thread, Open::Beside),
        tab,
        "same view is focused, not duplicated"
    );
    let home = ws.open(View::Home, Open::Here);
    assert_eq!(home, 1);
    assert_eq!(ws.focus, 10);
}

#[test]
fn open_beside_splits_when_rightmost() {
    let mut ws = Workspace::preset(true);
    ws.focus = 12;
    let before = pane_count(&ws);
    let tab = ws.open(
        View::Profile {
            pubkey: "b".repeat(64),
        },
        Open::Beside,
    );
    assert_eq!(pane_count(&ws), before + 1);
    assert_eq!(ws.focused_tab(), Some(tab));
}

#[test]
fn focus_moves_by_direction() {
    let mut ws = Workspace::preset(true);
    ws.apply(Command::Focus(Zone::Right));
    assert_eq!(ws.focus, 11);
    ws.apply(Command::Focus(Zone::Right));
    assert_eq!(ws.focus, 13, "the pane whose centre is nearest wins a tie");
    ws.apply(Command::Focus(Zone::Top));
    assert_eq!(ws.focus, 12);
    ws.apply(Command::Focus(Zone::Bottom));
    assert_eq!(ws.focus, 13);
    ws.apply(Command::Focus(Zone::Left));
    assert_eq!(ws.focus, 11);
    ws.apply(Command::Focus(Zone::Top));
    assert_eq!(ws.focus, 11, "no pane above: focus stays");
}

#[test]
fn closing_last_tab_leaves_a_launcher() {
    let mut ws = Workspace::preset(true);
    for tab in ws.tabs.keys().copied().collect::<Vec<_>>() {
        ws.close_tab(tab);
    }
    assert_eq!(pane_count(&ws), 1);
    assert_eq!(ws.tabs.values().collect::<Vec<_>>(), vec![&View::Launcher]);
    assert_eq!(ws.focused_pane().map(|p| p.id), Some(ws.focus));
}

#[test]
fn split_and_move_keep_tabs_unique() {
    let mut ws = Workspace::preset(true);
    ws.apply(Command::Split(Zone::Bottom));
    assert_eq!(pane_count(&ws), 5);
    ws.apply(Command::MoveTab(Zone::Right));
    let all = layout::tabs(&ws.root);
    let mut sorted = all.clone();
    sorted.sort_unstable();
    sorted.dedup();
    assert_eq!(all.len(), sorted.len());
    assert_eq!(all.len(), ws.tabs.len());
    ws.focus = 12;
    ws.apply(Command::Split(Zone::Right));
    assert!(
        ws.tabs.values().any(|v| *v == View::Launcher),
        "single-tab split opens +"
    );
}

#[test]
fn drop_reorders_within_strip() {
    let mut ws = Workspace::preset(true);
    ws.drop_tab(3, 10, Zone::Center, Some(0));
    let pane = layout::find_pane(&ws.root, 10).cloned();
    assert_eq!(pane.map(|p| p.tabs), Some(vec![3, 1, 2]));
}

#[test]
fn cycle_select_grow_and_new_tab() {
    let mut ws = Workspace::preset(true);
    ws.apply(Command::Cycle(1));
    assert_eq!(ws.focused_tab(), Some(2));
    ws.apply(Command::Cycle(-2));
    assert_eq!(ws.focused_tab(), Some(3));
    ws.apply(Command::Select(0));
    assert_eq!(ws.focused_tab(), Some(1));
    ws.apply(Command::Grow(2));
    let Node::Split(root) = &ws.root else {
        return;
    };
    assert!(root.sizes[0] > 0.45);
    assert!((root.sizes.iter().sum::<f64>() - 1.0).abs() < 1e-9);
    ws.apply(Command::NewTab);
    ws.apply(Command::NewTab);
    let launchers = ws.tabs.values().filter(|v| **v == View::Launcher).count();
    assert_eq!(launchers, 1, "a second + focuses the existing new-tab page");
}

#[test]
fn stored_layout_round_trips_and_repairs() {
    let mut ws = Workspace::preset(true);
    ws.open(
        View::Search {
            query: "rust".into(),
        },
        Open::Beside,
    );
    let json = serde_json::to_string(&ws).unwrap_or_default();
    let back: Workspace = serde_json::from_str(&json).unwrap_or_else(|_| Workspace::preset(true));
    assert_eq!(back, ws);
    let mut broken = ws.clone();
    broken.tabs.remove(&1);
    broken.focus = 999;
    let repaired = broken.repaired(true);
    assert!(!layout::tabs(&repaired.root).contains(&1));
    assert!(repaired.focused_pane().is_some());
}

#[test]
fn replace_view_converts_launcher_or_focuses_existing() {
    let mut ws = Workspace::preset(true);
    ws.apply(Command::NewTab);
    let launcher = ws.focused_tab().unwrap_or(0);
    ws.replace_view(launcher, View::Settings);
    assert_eq!(ws.tabs.get(&launcher), Some(&View::Settings));
    ws.apply(Command::NewTab);
    let second = ws.focused_tab().unwrap_or(0);
    ws.replace_view(second, View::Home);
    assert!(!ws.tabs.contains_key(&second));
    assert_eq!(ws.focused_tab(), Some(1));
}
