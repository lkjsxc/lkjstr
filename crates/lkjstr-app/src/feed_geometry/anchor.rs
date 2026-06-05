#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AnchorConfidence {
    Exact,
    Degraded,
    None,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MeasuredFeedRow {
    pub key: String,
    pub top_px: i32,
    pub height_px: i32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedScrollAnchor {
    pub row_key: String,
    pub offset_inside_row_px: i32,
    pub viewport_relative_top_px: i32,
    pub width_bucket: u16,
    pub generation: u64,
    pub confidence: AnchorConfidence,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AnchorReconcileResult {
    pub scroll_delta_px: i32,
    pub confidence: AnchorConfidence,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AnchorCompensation {
    pub scroll_delta_px: i32,
    pub should_apply: bool,
}

#[must_use]
pub fn capture_feed_anchor(
    rows: &[MeasuredFeedRow],
    scroll_top_px: i32,
    viewport_height_px: i32,
    width_bucket: u16,
    generation: u64,
) -> Option<FeedScrollAnchor> {
    let viewport_bottom = scroll_top_px.saturating_add(viewport_height_px.max(0));
    rows.iter()
        .find(|row| row_bottom(row) > scroll_top_px && row.top_px < viewport_bottom)
        .map(|row| FeedScrollAnchor {
            row_key: row.key.clone(),
            offset_inside_row_px: scroll_top_px.saturating_sub(row.top_px).max(0),
            viewport_relative_top_px: row.top_px.saturating_sub(scroll_top_px),
            width_bucket,
            generation,
            confidence: AnchorConfidence::Exact,
        })
}

#[must_use]
pub fn reconcile_feed_anchor(
    old_rows: &[MeasuredFeedRow],
    new_rows: &[MeasuredFeedRow],
    anchor: &FeedScrollAnchor,
) -> AnchorReconcileResult {
    if old_rows.is_empty() || new_rows.is_empty() {
        return no_delta(AnchorConfidence::None);
    }
    if let (Some(old_row), Some(new_row)) = (
        find_row(old_rows, &anchor.row_key),
        find_row(new_rows, &anchor.row_key),
    ) {
        return AnchorReconcileResult {
            scroll_delta_px: new_row.top_px.saturating_sub(old_row.top_px),
            confidence: AnchorConfidence::Exact,
        };
    }
    fallback_surviving_delta(old_rows, new_rows, anchor)
}

#[must_use]
pub fn anchor_compensation_for_height_delta(
    row_top_px: i32,
    viewport_top_px: i32,
    height_delta_px: i32,
) -> AnchorCompensation {
    let should_apply = row_top_px < viewport_top_px && height_delta_px != 0;
    AnchorCompensation {
        scroll_delta_px: if should_apply { height_delta_px } else { 0 },
        should_apply,
    }
}

fn fallback_surviving_delta(
    old_rows: &[MeasuredFeedRow],
    new_rows: &[MeasuredFeedRow],
    anchor: &FeedScrollAnchor,
) -> AnchorReconcileResult {
    let Some(anchor_index) = old_rows.iter().position(|row| row.key == anchor.row_key) else {
        return no_delta(AnchorConfidence::None);
    };
    if let Some(delta) = nearest_delta(old_rows, new_rows, anchor_index) {
        return AnchorReconcileResult {
            scroll_delta_px: delta,
            confidence: AnchorConfidence::Degraded,
        };
    }
    no_delta(AnchorConfidence::None)
}

fn nearest_delta(
    old_rows: &[MeasuredFeedRow],
    new_rows: &[MeasuredFeedRow],
    index: usize,
) -> Option<i32> {
    for distance in 1..=old_rows.len() {
        if let Some(delta) = delta_at(old_rows, new_rows, index.saturating_sub(distance)) {
            return Some(delta);
        }
        if let Some(delta) = delta_at(old_rows, new_rows, index.saturating_add(distance)) {
            return Some(delta);
        }
    }
    None
}

fn delta_at(
    old_rows: &[MeasuredFeedRow],
    new_rows: &[MeasuredFeedRow],
    index: usize,
) -> Option<i32> {
    let old_row = old_rows.get(index)?;
    let new_row = find_row(new_rows, &old_row.key)?;
    Some(new_row.top_px.saturating_sub(old_row.top_px))
}

fn find_row<'a>(rows: &'a [MeasuredFeedRow], key: &str) -> Option<&'a MeasuredFeedRow> {
    rows.iter().find(|row| row.key == key)
}

fn row_bottom(row: &MeasuredFeedRow) -> i32 {
    row.top_px.saturating_add(row.height_px.max(0))
}

fn no_delta(confidence: AnchorConfidence) -> AnchorReconcileResult {
    AnchorReconcileResult {
        scroll_delta_px: 0,
        confidence,
    }
}
