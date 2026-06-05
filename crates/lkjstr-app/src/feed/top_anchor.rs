#![doc = "Top-anchor live-prepend policy."]

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TopAnchorInput {
    pub scroll_offset_px: i64,
    pub top_tolerance_px: i64,
    pub active_visible: bool,
    pub restoring_snapshot: bool,
    pub older_pruned: bool,
    pub incoming_rows: usize,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TopAnchorAction {
    None,
    KeepAtTop,
    PreserveVisibleAnchor,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NewestCursorPolicy {
    Unchanged,
    AdvanceAfterResident,
    WaitForCatchUpProof,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TopAnchorDecision {
    pub at_top: bool,
    pub top_locked: bool,
    pub has_newer: bool,
    pub action: TopAnchorAction,
    pub newest_cursor: NewestCursorPolicy,
}

#[must_use]
pub fn decide_top_anchor(input: TopAnchorInput) -> TopAnchorDecision {
    let at_top = input.scroll_offset_px <= input.top_tolerance_px && !input.older_pruned;
    let top_locked = at_top && input.active_visible && !input.restoring_snapshot;
    let has_incoming = input.incoming_rows > 0;
    let action = match (has_incoming, top_locked) {
        (false, _) => TopAnchorAction::None,
        (true, true) => TopAnchorAction::KeepAtTop,
        (true, false) => TopAnchorAction::PreserveVisibleAnchor,
    };
    let newest_cursor = match (has_incoming, top_locked) {
        (false, _) => NewestCursorPolicy::Unchanged,
        (true, true) => NewestCursorPolicy::AdvanceAfterResident,
        (true, false) => NewestCursorPolicy::WaitForCatchUpProof,
    };
    TopAnchorDecision {
        at_top,
        top_locked,
        has_newer: has_incoming && !top_locked,
        action,
        newest_cursor,
    }
}
