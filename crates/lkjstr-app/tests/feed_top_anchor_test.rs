use lkjstr_app::{NewestCursorPolicy, TopAnchorAction, TopAnchorInput, decide_top_anchor};

#[test]
fn keeps_live_prepends_visible_at_top() {
    let decision = decide_top_anchor(TopAnchorInput {
        scroll_offset_px: 0,
        top_tolerance_px: 2,
        active_visible: true,
        restoring_snapshot: false,
        older_pruned: false,
        incoming_rows: 2,
    });

    assert!(decision.at_top);
    assert!(decision.top_locked);
    assert!(!decision.has_newer);
    assert_eq!(decision.action, TopAnchorAction::KeepAtTop);
    assert_eq!(
        decision.newest_cursor,
        NewestCursorPolicy::AdvanceAfterResident
    );
}

#[test]
fn preserves_visible_row_away_from_top() {
    let decision = decide_top_anchor(TopAnchorInput {
        scroll_offset_px: 400,
        top_tolerance_px: 2,
        active_visible: true,
        restoring_snapshot: false,
        older_pruned: false,
        incoming_rows: 1,
    });

    assert!(!decision.top_locked);
    assert!(decision.has_newer);
    assert_eq!(decision.action, TopAnchorAction::PreserveVisibleAnchor);
    assert_eq!(
        decision.newest_cursor,
        NewestCursorPolicy::WaitForCatchUpProof
    );
}

#[test]
fn does_not_lock_while_restoring_or_pruned() {
    for input in [restoring(), older_pruned()] {
        let decision = decide_top_anchor(input);
        assert!(!decision.top_locked);
        assert!(decision.has_newer);
    }
}

fn restoring() -> TopAnchorInput {
    TopAnchorInput {
        scroll_offset_px: 0,
        top_tolerance_px: 2,
        active_visible: true,
        restoring_snapshot: true,
        older_pruned: false,
        incoming_rows: 1,
    }
}

fn older_pruned() -> TopAnchorInput {
    TopAnchorInput {
        scroll_offset_px: 0,
        top_tolerance_px: 2,
        active_visible: true,
        restoring_snapshot: false,
        older_pruned: true,
        incoming_rows: 1,
    }
}
