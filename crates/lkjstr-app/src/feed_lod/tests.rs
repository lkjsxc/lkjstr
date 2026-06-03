use super::*;

fn row(index: usize, coverage: RowCoverageState) -> FeedLodRow {
    FeedLodRow {
        row_id: format!("row-{index}"),
        row_kind: FeedLodRowKind::Event,
        timestamp_seconds: 1_000 - index as u64,
        estimated_height_px: 100,
        measured_height_px: None,
        coverage,
        route_group: "selected".to_owned(),
        relay_provenance_count: 1,
        has_media: false,
        has_preview: false,
        reply_child_count: 0,
    }
}

#[test]
fn offset_mapping_uses_estimated_heights() {
    let tree = build_lod_tree(
        (0..40)
            .map(|index| row(index, RowCoverageState::Loaded))
            .collect(),
    );
    let location = offset_to_row(&tree, 350);

    assert!(matches!(location, Some(item) if item.row_id == "row-3"));
    assert_eq!(tree.blocks.len(), 2);
}

#[test]
fn height_update_keeps_offset_mapping_correct() {
    let tree = build_lod_tree(
        (0..8)
            .map(|index| row(index, RowCoverageState::Loaded))
            .collect(),
    );
    let update = height_delta_update(&tree, "row-1", 160);
    let location = offset_to_row(&update.tree, 270);

    assert_eq!(update.height_delta_px, 60);
    assert!(matches!(location, Some(item) if item.row_id == "row-2"));
}

#[test]
fn visible_range_adds_overscan() {
    let tree = build_lod_tree(
        (0..20)
            .map(|index| row(index, RowCoverageState::Loaded))
            .collect(),
    );
    let range = visible_range(&tree, 500, 200, 2);

    assert_eq!(range.start_index, 3);
    assert_eq!(range.end_index, 10);
}

#[test]
fn materialization_plan_does_not_include_everything_as_full() {
    let tree = build_lod_tree(
        (0..80)
            .map(|index| row(index, RowCoverageState::Loaded))
            .collect(),
    );
    let range = RowRange {
        start_index: 10,
        end_index: 20,
    };
    let plan = materialization_plan(&tree, &range);

    assert_eq!(plan.full_row_ids.len(), 10);
    assert!(plan.shell_row_ids.len() < tree.rows.len());
}

#[test]
fn coverage_projection_counts_real_gap_states() {
    let tree = build_lod_tree(vec![
        row(0, RowCoverageState::Loaded),
        row(1, RowCoverageState::Uncovered),
        row(2, RowCoverageState::Incomplete),
        row(3, RowCoverageState::Dense),
    ]);
    let projection = coverage_gap_projection(&tree);

    assert_eq!(projection.uncovered_count, 1);
    assert_eq!(projection.incomplete_count, 1);
    assert_eq!(projection.dense_count, 1);
}
