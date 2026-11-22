mod engine_acts_support;
use engine_acts_support::*;
use lkjstr_core::engine::{
    Engine,
    protocol::{Input, Output, Patch},
    rows::Row,
    wire::queries::Query,
};

fn authored(row: &Row, id: &str, at: u64) {
    assert_eq!(row.id, id);
    assert_eq!(row.created_at, at);
    assert!(row.reposts.is_empty(), "Profile All has no repost actors");
    assert_eq!(row.reposted_at, None);
    assert_eq!(row.window_reading_at, Some(at));
}

#[test]
fn core_profile_all_initial_and_upsert_rows_keep_authored_time() -> Test {
    let note = event(1, 10, 1, "original", vec![])?;
    let own = act(1, 30, 6, "", &note)?;
    let other = act(2, 40, 6, "", &note)?;
    let mut engine = Engine::new();
    put(&mut engine, &[&note, &own, &other]);
    let query: Query = serde_json::from_value(profile(&note.pubkey, &note.pubkey, "all"))?;
    engine.input(
        Input::Open {
            sub: "person".into(),
            query: query.convert().ok_or("query")?,
        },
        0,
    );
    let initial = engine
        .drain()
        .into_iter()
        .find_map(|output| match output {
            Output::Rows { items, .. } => Some(items),
            _ => None,
        })
        .ok_or("initial core rows")?;
    assert_eq!(initial.len(), 2);
    authored(&initial[1], &note.id, 10);
    authored(&initial[0], &own.id, 30);
    let late = act(3, 50, 6, "", &note)?;
    engine.enqueue("cache".into(), late);
    engine.tick(60_000);
    let update = engine
        .drain()
        .into_iter()
        .find_map(|output| match output {
            Output::Patch { ops, .. } => ops.into_iter().find_map(|op| match op {
                Patch::Upsert { item, .. } if item.id == note.id => Some(item),
                _ => None,
            }),
            _ => None,
        })
        .ok_or("core upsert for changed repost count")?;
    assert_eq!(update.counts.reposts, 3);
    authored(&update, &note.id, 10);
    Ok(())
}
