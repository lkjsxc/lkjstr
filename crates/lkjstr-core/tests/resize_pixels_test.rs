use lkjstr_core::{Workspace, layout};

fn extent(ws: &Workspace, width: f64, height: f64) -> (f64, f64) {
    layout::pane_rects(&ws.root)
        .into_iter()
        .find(|(id, _)| *id == ws.focus)
        .map(|(_, r)| (r.w * width, r.h * height))
        .unwrap_or_default()
}

#[test]
fn keyboard_resize_is_exactly_forty_physical_pixels_in_both_axes() {
    for (focus, horizontal) in [(10, true), (12, false)] {
        let mut ws = Workspace::preset(false);
        ws.focus = focus;
        let (w, h) = extent(&ws, 1440.0, 900.0);
        ws.grow_pixels(1, 1440.0, 900.0);
        let (next_w, next_h) = extent(&ws, 1440.0, 900.0);
        assert!(((if horizontal { next_w - w } else { next_h - h }) - 40.0).abs() < 0.01);
        ws.grow_pixels(-1, 1440.0, 900.0);
        let (back_w, back_h) = extent(&ws, 1440.0, 900.0);
        assert!((back_w - w).abs() < 0.01 && (back_h - h).abs() < 0.01);
    }
}

#[test]
fn resize_never_shrinks_a_neighbour_below_its_minimum() {
    let mut ws = Workspace::preset(false);
    for _ in 0..100 {
        ws.grow_pixels(1, 1440.0, 900.0);
    }
    for (_, rect) in layout::pane_rects(&ws.root) {
        assert!(rect.w * 1440.0 >= 159.99);
    }
}
