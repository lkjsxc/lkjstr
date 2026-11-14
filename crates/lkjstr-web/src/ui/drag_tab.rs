//! Tab click versus drag. Dropping on a pane edge splits it, on the body
//! joins its stack, on a strip inserts at the caret.

use std::cell::Cell;
use std::rc::Rc;

use leptos::prelude::*;
use lkjstr_core::layout::{TabId, Zone};
use wasm_bindgen::JsCast;
use web_sys::{Element, HtmlElement, PointerEvent};

use super::{DRAG_PX, STRIP_PX, Target, listen, pane_rects, preview, zone_at};
use crate::ui::Ui;

fn layer_element(class: &str, text: &str) -> Option<HtmlElement> {
    let document = web_sys::window()?.document()?;
    let element = document
        .create_element("div")
        .ok()?
        .dyn_into::<HtmlElement>()
        .ok()?;
    element.set_class_name(class);
    element.set_text_content(Some(text));
    document.body()?.append_child(&element).ok()?;
    Some(element)
}

/// Insertion index among strip tab rects for pointer x, and the caret x.
fn insert_at(strip: &Element, x: f64) -> (usize, f64) {
    let Ok(tabs) = strip.query_selector_all(".tab") else {
        return (0, 0.0);
    };
    let rects: Vec<_> = (0..tabs.length())
        .filter_map(|i| tabs.item(i)?.dyn_into::<Element>().ok())
        .map(|tab| tab.get_bounding_client_rect())
        .collect();
    let index = rects
        .iter()
        .position(|r| x < r.left() + r.width() / 2.0)
        .unwrap_or(rects.len());
    let caret = match rects.get(index) {
        Some(rect) => rect.left(),
        None => rects.last().map_or(0.0, |r| r.right()),
    };
    (index, caret)
}

pub fn start_tab_drag(ev: PointerEvent, ui: Ui, tab: TabId, label: String) {
    if ev.button() != 0 {
        return;
    }
    let Some(element) = ev
        .current_target()
        .and_then(|t| t.dyn_into::<Element>().ok())
    else {
        return;
    };
    let _ = element.set_pointer_capture(ev.pointer_id());
    let (sx, sy) = (f64::from(ev.client_x()), f64::from(ev.client_y()));
    let panes = pane_rects();
    let dragging = Rc::new(Cell::new(false));
    let target: Rc<Cell<Option<Target>>> = Rc::default();
    let drop_box = layer_element("drop-preview", "");
    let ghost = layer_element("drag-ghost", &label);
    for el in [&drop_box, &ghost].into_iter().flatten() {
        el.set_hidden(true);
    }
    let (drag_flag, target_set) = (dragging.clone(), target.clone());
    let (box_move, ghost_move) = (drop_box.clone(), ghost.clone());
    let on_move = move |ev: &PointerEvent| {
        let (x, y) = (f64::from(ev.client_x()), f64::from(ev.client_y()));
        if !drag_flag.get() && (x - sx).hypot(y - sy) < DRAG_PX {
            return;
        }
        drag_flag.set(true);
        if let Some(ghost) = &ghost_move {
            ghost.set_hidden(false);
            let _ = ghost.style().set_property(
                "transform",
                &format!("translate({}px, {}px)", x + 12.0, y + 8.0),
            );
        }
        let hit = panes
            .iter()
            .find(|(_, _, r)| x >= r.left() && x < r.right() && y >= r.top() && y < r.bottom());
        let Some(drop_box) = &box_move else { return };
        let Some((id, element, rect)) = hit else {
            drop_box.set_hidden(true);
            target_set.set(None);
            return;
        };
        drop_box.set_hidden(false);
        let style = drop_box.style();
        if y - rect.top() < STRIP_PX {
            let strip = element.query_selector(".strip").ok().flatten();
            let (index, caret) = strip.map_or((0, rect.left()), |s| insert_at(&s, x));
            target_set.set(Some((*id, Zone::Center, Some(index))));
            drop_box.set_class_name("drop-preview caret");
            style.set_css_text(&format!(
                "left:{}px;top:{}px;height:{}px",
                caret - 1.0,
                rect.top() + 4.0,
                STRIP_PX - 8.0
            ));
            return;
        }
        let zone = zone_at(rect, x, y);
        target_set.set(Some((*id, zone, None)));
        let (px, py, pw, ph) = preview(rect, zone);
        drop_box.set_class_name("drop-preview");
        style.set_css_text(&format!(
            "left:{px}px;top:{py}px;width:{pw}px;height:{ph}px"
        ));
    };
    let on_end = move || {
        for el in [&drop_box, &ghost].into_iter().flatten() {
            el.remove();
        }
        if !dragging.get() {
            ui.ws.update(|ws| ws.activate(tab));
        } else if let Some((pane, zone, index)) = target.get() {
            ui.ws.update(|ws| ws.drop_tab(tab, pane, zone, index));
        }
    };
    listen(&element, on_move, on_end);
}
