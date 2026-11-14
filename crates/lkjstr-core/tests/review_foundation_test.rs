use lkjstr_core::{Open, View, Workspace, layout, reactions, store::Store};
use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};

#[test]
fn unchanged_neighbour_preview_reactivates_without_changing_history() {
    let mut ws = Workspace::preset(true);
    let source = ws.focus;
    let preview = ws.open_detail(View::Global, 1440.0, false, false);
    ws.navigate(preview, View::Relays);
    assert!(ws.travel(-1));
    let history = ws.navigation.histories[&preview].clone();
    let other = ws.open(
        View::Search {
            query: "other".into(),
        },
        Open::Here,
    );
    ws.activate(other);
    ws.focus = source;
    assert_eq!(ws.open_detail(View::Global, 1440.0, false, false), preview);
    assert_eq!(ws.focused_tab(), Some(preview));
    assert_eq!(
        layout::pane_of_tab(&ws.root, preview).map(|p| p.active),
        Some(preview)
    );
    assert_eq!(ws.navigation.histories[&preview], history);
}

#[test]
fn pane_close_at_capacity_records_one_recovery_and_one_undo() {
    for count in [31, 32] {
        let mut ws = Workspace::preset(true);
        let mut closed = Vec::new();
        for _ in 0..count {
            let tab = ws.open(View::Launcher, Open::Here);
            ws.close_tab(tab);
            closed.push(tab);
        }
        let oldest = ws.navigation.closed[1].clone();
        let before = serde_json::to_string(&ws).unwrap_or_default();
        let doomed = layout::find_pane(&ws.root, 10)
            .map(|p| p.tabs.clone())
            .unwrap_or_default();
        ws.close_pane(10);
        assert_eq!(ws.navigation.closed.len(), 32);
        if count == 32 {
            assert_eq!(ws.navigation.closed[0], oldest);
        }
        assert_eq!(
            ws.navigation.closed.last().map(|entry| &entry.2),
            Some(&doomed)
        );
        let after = serde_json::to_string(&ws).unwrap_or_default();
        let mut undo = ws.clone();
        undo.undo_layout();
        assert_eq!(serde_json::to_string(&undo).unwrap_or_default(), before);
        // Reopen after a later edit must not consume intermediate pane closures.
        ws.open(View::Settings, Open::Here);
        ws.reopen();
        for tab in &doomed {
            assert!(ws.tabs.contains_key(tab));
        }
        ws.reopen();
        assert!(ws.tabs.contains_key(closed.last().unwrap_or(&0)));
        assert_ne!(before, after);
    }
}

#[test]
fn reaction_chips_counts_and_ownership_follow_only_the_final_target() {
    let key = generate_secret_key();
    let sign = |kind, tags| {
        finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at: 10,
                kind,
                tags,
                content: "+".into(),
            },
            &key,
        )
        .unwrap_or_else(|_| unreachable!("valid fixture"))
    };
    let ancestor = "a".repeat(64);
    let target = "b".repeat(64);
    let mut store = Store::new(100);
    let reaction = sign(
        7,
        vec![
            vec!["e".into(), ancestor.clone()],
            vec!["e".into(), target.clone()],
        ],
    );
    let me = reaction.pubkey.clone();
    store.insert(reaction.clone(), None);
    store.insert(sign(1, vec![vec!["q".into(), ancestor.clone()]]), None);
    assert_eq!(store.referencing(&ancestor).len(), 2);
    assert!(store.reactions(&ancestor).is_empty());
    assert!(reactions::chips(&store.reactions(&ancestor), Some(&me)).is_empty());
    assert_eq!(store.counts(&ancestor).2, 0);
    let chips = reactions::chips(&store.reactions(&target), Some(&me));
    assert_eq!(chips.len(), 1);
    assert_eq!(chips[0].own.as_deref(), Some(reaction.id.as_str()));
    assert_eq!(chips[0].count, 1);
}
