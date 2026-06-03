#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AnchorCompensation {
    pub scroll_delta_px: i32,
    pub should_apply: bool,
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
