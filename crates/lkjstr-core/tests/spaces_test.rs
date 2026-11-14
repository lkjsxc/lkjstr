use lkjstr_core::{Open, View, spaces::Spaces};
#[test]
fn switches_and_moves_keep_independent_views_and_identity() {
    let mut spaces = Spaces::default();
    let mut current = spaces.desks[0].clone();
    let tab = current.open(View::Global, Open::Here);
    let mut original = current.clone();
    current = spaces
        .switch(&current, 1)
        .unwrap_or_else(|| current.clone());
    assert_ne!(current, original);
    current.open(View::Settings, Open::Here);
    let second = current.clone();
    current = spaces
        .switch(&current, 0)
        .unwrap_or_else(|| current.clone());
    original.next_id = current.next_id;
    assert_eq!(current, original);
    assert!(spaces.move_tab(&mut current, tab, 1));
    assert!(!current.tabs.contains_key(&tab));
    assert_eq!(spaces.desks[1].tabs[&tab], View::Global);
    assert_eq!(spaces.desks[1].navigation.recent.first(), Some(&tab));
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

fn assert_unique(spaces: &Spaces, current: &lkjstr_core::Workspace) {
    fn nodes(root: &lkjstr_core::layout::Node, seen: &mut std::collections::BTreeSet<u32>) {
        assert!(seen.insert(root.id()), "duplicate node {}", root.id());
        if let lkjstr_core::layout::Node::Split(split) = root {
            for child in &split.children {
                nodes(child, seen);
            }
        }
    }
    let mut seen = std::collections::BTreeSet::new();
    for (index, ws) in spaces.desks.iter().enumerate() {
        let ws = if index == spaces.active { current } else { ws };
        nodes(&ws.root, &mut seen);
        for tab in ws.tabs.keys() {
            assert!(seen.insert(*tab), "duplicate tab {tab}");
        }
    }
}

#[test]
fn allocation_after_moves_stays_unique_across_the_bank_and_reloads()
-> Result<(), Box<dyn std::error::Error>> {
    let mut spaces = Spaces::default();
    let mut current = spaces.desks[2].clone();
    spaces.active = 2;
    let compose = current.focused_tab().ok_or("compose tab missing")?;
    let notifications = current
        .tabs
        .iter()
        .find(|(_, v)| **v == View::Notifications)
        .ok_or("notifications missing")?
        .0;
    let notifications = *notifications;
    assert!(spaces.move_tab(&mut current, compose, 1));
    assert_unique(&spaces, &current);
    current = spaces.switch(&current, 1).ok_or("switch failed")?;
    let fresh = current.open(View::Compose { reply_to: None }, Open::Here);
    assert_ne!(fresh, notifications);
    assert_unique(&spaces, &current);
    assert!(spaces.move_tab(&mut current, fresh, 2));
    current = spaces.switch(&current, 2).ok_or("switch failed")?;
    assert_eq!(current.tabs[&notifications], View::Notifications);
    assert_eq!(current.tabs[&fresh], View::Compose { reply_to: None });
    current.open(View::Global, Open::Split);
    assert_unique(&spaces, &current);
    spaces.desks[spaces.active] = current;
    let mut spaces =
        Spaces::parse(&serde_json::to_string(&spaces)?, false).ok_or("bank rejected")?;
    let mut current = spaces.desks[spaces.active].clone();
    for to in 0..9 {
        if let Some(next) = spaces.switch(&current, to) {
            current = next;
        }
        current.open(View::Compose { reply_to: None }, Open::Split);
        assert_unique(&spaces, &current);
    }
    Ok(())
}

#[test]
fn resets_remap_every_identity_and_preserve_recovery() -> Result<(), Box<dyn std::error::Error>> {
    let mut spaces = Spaces::default();
    let first = spaces.desks[0].clone();
    let mut current = spaces.switch(&first, 2).ok_or("switch failed")?;
    let before = current.clone();
    current.reset_to_preset(false);
    assert_unique(&spaces, &current);
    assert!(current.tabs.keys().all(|id| !before.tabs.contains_key(id)));
    assert!(lkjstr_core::layout::find_pane(&current.root, current.focus).is_some());
    let reset = current.clone();
    current.reset_to_preset(true);
    assert!(current.tabs.keys().all(|id| !reset.tabs.contains_key(id)));
    assert_unique(&spaces, &current);
    assert!(spaces.recover(&mut current, false));
    assert_eq!(current.tabs, reset.tabs);
    assert!(spaces.recover(&mut current, false));
    assert_eq!(current.tabs, before.tabs);
    current.open(View::Compose { reply_to: None }, Open::Here);
    assert_unique(&spaces, &current);
    Ok(())
}

#[test]
fn stored_banks_reject_cross_desk_identity_collisions() -> Result<(), Box<dyn std::error::Error>> {
    let mut spaces = Spaces::default();
    spaces.desks[1] = spaces.desks[0].clone();
    assert!(Spaces::parse(&serde_json::to_string(&spaces)?, false).is_none());
    Ok(())
}

#[test]
fn imported_layouts_reserve_bank_ids_and_reject_colliding_tabs()
-> Result<(), Box<dyn std::error::Error>> {
    let mut spaces = Spaces::default();
    let mut imported = spaces.desks[1].clone();
    imported.next_id += 100;
    let deleted = imported.open(View::Compose { reply_to: None }, Open::Here);
    imported.close_tab(deleted);
    assert!(spaces.install(1, imported));
    let mut current = spaces.desks[0].clone();
    let tab = current.open(View::Compose { reply_to: None }, Open::Here);
    assert!(tab > deleted);
    assert_unique(&spaces, &current);
    let before = serde_json::to_string(&spaces)?;
    assert!(!spaces.install(1, current));
    assert_eq!(serde_json::to_string(&spaces)?, before);
    Ok(())
}

#[test]
fn moving_the_last_tab_allocates_a_unique_source_launcher() -> Result<(), Box<dyn std::error::Error>>
{
    let mut spaces = Spaces {
        active: 3,
        ..Spaces::default()
    };
    let mut current = spaces.desks[3].clone();
    let tab = current.focused_tab().ok_or("launcher missing")?;
    current.replace_view(tab, View::Compose { reply_to: None });
    current.pin(tab);
    let history = current.navigation.histories[&tab].clone();
    assert!(spaces.move_tab(&mut current, tab, 0));
    assert_eq!(spaces.desks[0].navigation.histories[&tab], history);
    assert!(spaces.desks[0].navigation.pinned.contains(&tab));
    assert_eq!(current.tabs.len(), 1);
    assert_eq!(current.tabs.values().next(), Some(&View::Launcher));
    assert_unique(&spaces, &current);
    current = spaces.switch(&current, 0).ok_or("switch failed")?;
    current.open(View::Compose { reply_to: None }, Open::Here);
    assert_unique(&spaces, &current);
    Ok(())
}
