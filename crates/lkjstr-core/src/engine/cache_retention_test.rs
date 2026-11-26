use super::*;
use crate::{
    engine::protocol::{Input, Query, Source},
    store::Store,
};
use lkjstr_protocol::NostrEvent;
fn event(id: u64, author: u64, kind: u64) -> NostrEvent {
    NostrEvent {
        id: format!("{id:064x}"),
        pubkey: format!("{author:064x}"),
        created_at: 1,
        kind,
        tags: vec![],
        content: if kind == 0 {
            r#"{"name":"known"}"#.into()
        } else {
            String::new()
        },
        sig: "0".repeat(128),
    }
}
#[test]
fn metadata_observations_exclude_absent_follow_graph_authors() {
    let mut engine = Engine::new();
    engine.store = Store::new(16);
    let profile = event(1, 1, 0);
    let mut note = event(2, 1, 1);
    note.created_at = 1_799_999_999;
    let mut follows = event(3, 6000, 3);
    follows.tags = (1..=5000)
        .map(|author| vec!["p".into(), format!("{author:064x}")])
        .collect();
    for event in [&profile, &note, &follows] {
        engine.store.insert(event.clone(), None);
    }
    engine.input(
        Input::Open {
            sub: "their".into(),
            query: Query {
                source: Source::TheirHome,
                target: Some(follows.pubkey.clone()),
                ..Default::default()
            },
        },
        1_800_000_000_000,
    );
    assert!(
        engine.views["their"]
            .rows
            .iter()
            .any(|row| row.id == note.id)
    );
    let (access, rows) = engine.cache_metadata_observation(1_800_000_000_000);
    assert_eq!(
        access.authors.len(),
        2,
        "only the retained profile and follow-list author need hints"
    );
    assert_eq!(access.authors.get(&profile.pubkey), Some(&64));
    assert!(rows.iter().any(|row| row.id == profile.id));
    assert!(rows.iter().any(|row| row.id == follows.id));
}
