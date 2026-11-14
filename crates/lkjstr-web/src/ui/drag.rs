//! Pointer interactions ported from ytenrich's WM: split resizing (live flex
//! updates, one commit on release) and tab drag (edge splits, stack joins,
//! strip reordering with a caret preview).

use std::cell::RefCell;
use std::rc::Rc;

use leptos::prelude::*;
use lkjstr_core::layout::{Dir, NodeId, Zone};
use wasm_bindgen::{JsCast, closure::Closure};
use web_sys::{DomRect, Element, HtmlElement, PointerEvent};

use super::Ui;

const DRAG_PX: f64 = 4.0;
const STRIP_PX: f64 = 36.0;

type Listener = Closure<dyn FnMut(PointerEvent)>;

/// Keeps move/up listeners alive until the gesture ends.
fn listen(
    target: &Element,
    mut on_move: impl FnMut(&PointerEvent) + 'static,
    on_end: impl FnOnce() + 'static,
) {
    let slot: Rc<RefCell<Option<(Listener, Listener)>>> = Rc::default();
    let moving = Listener::new(move |ev: PointerEvent| on_move(&ev));
    let release = slot.clone();
    let element = target.clone();
    let mut end = Some(on_end);
    let ending = Listener::new(move |_: PointerEvent| {
        if let Some((moving, ending)) = release.borrow_mut().take() {
            let _ = element.remove_event_listener_with_callback(
                "pointermove",
                moving.as_ref().unchecked_ref(),
            );
            let _ = element.remove_event_listener_with_callback(
                "lostpointercapture",
                ending.as_ref().unchecked_ref(),
            );
        }
        if let Some(end) = end.take() {
            end();
        }
    });
    let _ = target.add_event_listener_with_callback("pointermove", moving.as_ref().unchecked_ref());
    let _ = target
        .add_event_listener_with_callback("lostpointercapture", ending.as_ref().unchecked_ref());
    *slot.borrow_mut() = Some((moving, ending));
}

fn grow(cell: &HtmlElement) -> f64 {
    cell.style()
        .get_property_value("flex-grow")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(1.0)
}

pub fn start_resize(ev: PointerEvent, ui: Ui, split: NodeId, dir: Dir) {
    if ev.button() != 0 {
        return;
    }
    let Some(handle) = ev
        .current_target()
        .and_then(|t| t.dyn_into::<Element>().ok())
    else {
        return;
    };
    let Some(b) = handle
        .parent_element()
        .and_then(|e| e.dyn_into::<HtmlElement>().ok())
    else {
        return;
    };
    let Some(a) = b
        .previous_element_sibling()
        .and_then(|e| e.dyn_into::<HtmlElement>().ok())
    else {
        return;
    };
    let Some(parent) = b.parent_element() else {
        return;
    };
    ev.prevent_default();
    let _ = handle.set_pointer_capture(ev.pointer_id());
    let _ = handle.class_list().add_1("active");
    let axis = move |rect: DomRect| {
        if dir == Dir::Row {
            rect.width()
        } else {
            rect.height()
        }
    };
    let pos = move |ev: &PointerEvent| {
        f64::from(if dir == Dir::Row {
            ev.client_x()
        } else {
            ev.client_y()
        })
    };
    let start_a = axis(a.get_bounding_client_rect());
    let pair_px = start_a + axis(b.get_bounding_client_rect());
    let pair_grow = grow(&a) + grow(&b);
    let start = pos(&ev);
    let anchors = super::feed_memory::resize_anchors();
    let (move_a, move_b) = (a.clone(), b.clone());
    let on_move = move |ev: &PointerEvent| {
        let px =
            lkjstr_core::sizes::resized_pair(start_a, pair_px, pos(ev) - start, dir == Dir::Row);
        let share = pair_grow * px / pair_px;
        let _ = move_a.style().set_property("flex-grow", &share.to_string());
        let _ = move_b
            .style()
            .set_property("flex-grow", &(pair_grow - share).to_string());
        super::feed_memory::keep_anchors(&anchors);
    };
    let handle_end = handle.clone();
    let on_end = move || {
        let _ = handle_end.class_list().remove_1("active");
        let cells = parent.children();
        let sizes: Vec<f64> = (0..cells.length())
            .filter_map(|i| cells.item(i)?.dyn_into::<HtmlElement>().ok())
            .map(|cell| grow(&cell))
            .collect();
        ui.ws.update(|ws| ws.resize(split, &sizes));
    };
    listen(&handle, on_move, on_end);
}

/// Equalise just the adjacent pair, preserving other siblings.
pub fn equalise(ev: web_sys::MouseEvent, ui: Ui, split: NodeId) {
    let Some(b) = ev
        .current_target()
        .and_then(|t| t.dyn_into::<Element>().ok())
        .and_then(|e| e.parent_element())
    else {
        return;
    };
    let Some(parent) = b.parent_element() else {
        return;
    };
    let cells = parent.children();
    let mut sizes: Vec<_> = (0..cells.length())
        .filter_map(|i| cells.item(i)?.dyn_into::<HtmlElement>().ok())
        .map(|c| grow(&c))
        .collect();
    let at = (0..cells.length())
        .position(|i| cells.item(i).is_some_and(|c| c == b))
        .unwrap_or(0);
    if at == 0 {
        return;
    }
    let mean = (sizes[at - 1] + sizes[at]) / 2.0;
    sizes[at - 1] = mean;
    sizes[at] = mean;
    ui.ws.update(|ws| ws.resize(split, &sizes));
}

fn zone_at(rect: &DomRect, x: f64, y: f64) -> Zone {
    if y - rect.top() < STRIP_PX {
        return Zone::Center;
    }
    let fx = (x - rect.left()) / rect.width();
    let fy = (y - rect.top()) / rect.height();
    let edges = [
        (Zone::Left, fx),
        (Zone::Right, 1.0 - fx),
        (Zone::Top, fy),
        (Zone::Bottom, 1.0 - fy),
    ];
    let (zone, dist) = edges
        .into_iter()
        .fold((Zone::Center, f64::MAX), |best, item| {
            if item.1 < best.1 { item } else { best }
        });
    if dist < 0.25 { zone } else { Zone::Center }
}

/// Preview rectangle (x, y, w, h) for a drop.
fn preview(rect: &DomRect, zone: Zone) -> (f64, f64, f64, f64) {
    let (x, y, w, h) = (rect.left(), rect.top(), rect.width(), rect.height());
    match zone {
        Zone::Left => (x, y, w / 2.0, h),
        Zone::Right => (x + w / 2.0, y, w / 2.0, h),
        Zone::Top => (x, y, w, h / 2.0),
        Zone::Bottom => (x, y + h / 2.0, w, h / 2.0),
        Zone::Center => (x, y, w, h),
    }
}

#[path = "drag_tab.rs"]
mod tab;
pub use tab::start_tab_drag;

fn rect_of(element: &Element) -> DomRect {
    element.get_bounding_client_rect()
}

fn pane_rects() -> Vec<(NodeId, Element, DomRect)> {
    let Some(document) = web_sys::window().and_then(|w| w.document()) else {
        return Vec::new();
    };
    let Ok(list) = document.query_selector_all(".pane[data-pane]") else {
        return Vec::new();
    };
    (0..list.length())
        .filter_map(|i| list.item(i)?.dyn_into::<Element>().ok())
        .filter_map(|el| {
            let id = el.get_attribute("data-pane")?.parse().ok()?;
            let rect = rect_of(&el);
            (rect.width() > 0.0).then_some((id, el, rect))
        })
        .collect()
}

type Target = (NodeId, Zone, Option<usize>);
