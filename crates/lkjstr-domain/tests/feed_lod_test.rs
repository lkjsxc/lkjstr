use lkjstr_domain::{
    FeedLodLevel, FeedLodRow, MaterializationAction, RecoveryRecipe, RetentionSignals,
    apply_forgetting, build_lod_tree, forgetting_plan, materialization_plan, recovery_recipe_for,
    retention_score,
};

#[test]
fn builds_blocks_with_stable_height_and_time_range() {
    let rows = rows(5);
    let tree = build_lod_tree(&rows, 2);
    assert_eq!(tree.len(), 3);
    assert_eq!(tree[0].height, 21);
    assert_eq!(tree[0].min_created_at, 99);
    assert_eq!(tree[0].max_created_at, 100);
}

#[test]
fn materializes_visible_and_overscan_blocks() {
    let tree = build_lod_tree(&rows(6), 2);
    let plan = materialization_plan(&tree, 2, 3, 1);
    assert_eq!(plan.len(), 2);
    assert_eq!(plan[0], MaterializationAction::KeepFull("block:0:2".into()));
    assert_eq!(plan[1], MaterializationAction::KeepFull("block:2:4".into()));
}

#[test]
fn forgetting_degrades_low_score_unprotected_nodes() {
    let mut tree = build_lod_tree(&rows(4), 2);
    tree[0].retention_score = -10;
    tree[1].retention_score = 20;
    tree[1].hard_protected = true;
    let plan = forgetting_plan(&tree, 0, 8);
    let degraded = apply_forgetting(&tree, &plan);
    assert_eq!(plan.len(), 1);
    assert_eq!(degraded[0].level, FeedLodLevel::Shell);
    assert_eq!(degraded[1].level, FeedLodLevel::Full);
}

#[test]
fn recovery_recipe_uses_block_interval_recipe() -> Result<(), &'static str> {
    let tree = build_lod_tree(&rows(4), 2);
    let recipe = recovery_recipe_for(&tree, 3).ok_or("missing recipe")?;
    assert_eq!(recipe.feed_key, "home");
    assert_eq!(recipe.since, 0);
    assert_eq!(recipe.until, 1000);
    Ok(())
}

#[test]
fn retention_score_penalizes_byte_cost() {
    let score = retention_score(RetentionSignals {
        visibility: 10,
        active_owner: 5,
        user_interaction: 2,
        recency: 3,
        notification: 0,
        thread_anchor: 0,
        route_value: 4,
        coverage_value: 1,
        recovery_cost: 8,
        byte_cost: 20,
    });
    assert_eq!(score, 13);
}

fn rows(count: usize) -> Vec<FeedLodRow> {
    (0..count)
        .map(|index| FeedLodRow {
            id: format!("event:{index}"),
            created_at: 100 - index as i64,
            estimated_height: 10,
            measured_height: (index == 1).then_some(11),
            retention_score: index as i32,
            hard_protected: false,
            recipe: recipe(),
        })
        .collect()
}

fn recipe() -> RecoveryRecipe {
    RecoveryRecipe {
        feed_key: "home".into(),
        route_fingerprint: "selected".into(),
        since: 0,
        until: 1000,
    }
}
