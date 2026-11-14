use lkjstr_core::{Open, View, Workspace, layout};

#[test]
fn closing_uses_tile_history_then_right_then_left() {
    let mut ws = Workspace::preset(false);
    let a = ws.open(View::Global, Open::Here);
    let b = ws.open(View::Global, Open::Here);
    let c = ws.open(View::Settings, Open::Here);
    ws.activate(a);
    ws.activate(c);
    ws.close_tab(c);
    assert_eq!(ws.focused_tab(), Some(a));
    ws.close_tab(b);
    assert_eq!(ws.focused_tab(), Some(a));
    ws.navigation.recent.clear();
    let right = ws.open(View::Home, Open::Here);
    ws.navigation.recent.clear();
    ws.activate(a);
    ws.close_tab(a);
    assert_eq!(ws.focused_tab(), Some(right));
}

#[test]
fn duplicate_and_pin_are_independent_and_bulk_close_preserves_pins() {
    let mut ws = Workspace::preset(false);
    let a = ws.open(View::Global, Open::Here);
    let b = ws.duplicate(a).unwrap_or_default();
    assert_ne!(a, b);
    assert_eq!(ws.tabs[&a], ws.tabs[&b]);
    ws.pin(a);
    assert_eq!(ws.focused_pane().and_then(|p| p.tabs.first()), Some(&a));
    ws.close_others(b, false);
    assert!(ws.tabs.contains_key(&a));
    assert!(ws.tabs.contains_key(&b));
    ws.close_tab(b);
    ws.close_tab(a);
    assert!(layout::find_pane(&ws.root, ws.focus).is_some());
}
