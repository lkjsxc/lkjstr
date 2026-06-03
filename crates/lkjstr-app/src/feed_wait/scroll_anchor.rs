#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScrollAnchor {
    pub event_id: Option<String>,
    pub offset_px: i32,
    pub near_top: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScrollAnchorDecision {
    pub preserve_anchor: bool,
    pub stage_newer_available: bool,
}

#[must_use]
pub fn scroll_anchor_for_late_insert(
    anchor: &ScrollAnchor,
    inserted_above: bool,
) -> ScrollAnchorDecision {
    if anchor.near_top || !inserted_above {
        ScrollAnchorDecision {
            preserve_anchor: false,
            stage_newer_available: false,
        }
    } else {
        ScrollAnchorDecision {
            preserve_anchor: true,
            stage_newer_available: true,
        }
    }
}
