use leptos::{html::Div, prelude::*};

#[cfg(target_arch = "wasm32")]
use leptos::wasm_bindgen::{JsCast, closure::Closure};
#[cfg(target_arch = "wasm32")]
use std::{cell::Cell, rc::Rc, time::Duration};
#[cfg(target_arch = "wasm32")]
use web_sys::{HtmlElement, ResizeObserver};

#[cfg(target_arch = "wasm32")]
use send_wrapper::SendWrapper;

#[path = "feed_resize_anchor_batch.rs"]
mod feed_resize_anchor_batch;

pub(super) use feed_resize_anchor_batch::{ResizeAnchorBatch, resize_anchor_batch};

#[cfg(target_arch = "wasm32")]
struct RowResizeObserver {
    observer: ResizeObserver,
    row: HtmlElement,
    _callback: Closure<dyn FnMut()>,
}

pub(super) fn observe_row_resize(
    batch: ResizeAnchorBatch,
    scroll_node: NodeRef<Div>,
    row_node: NodeRef<Div>,
) {
    #[cfg(target_arch = "wasm32")]
    Effect::new(move |_| {
        let Some(row) = row_node.get() else {
            return;
        };
        let row_element: HtmlElement = row.clone().into();
        if row_element.has_attribute("data-resize-anchor-observer") {
            return;
        }
        let _ = row_element.set_attribute("data-resize-anchor-observer", "attaching");
        let previous_height = Rc::new(Cell::new(row.offset_height().max(0)));
        let ready = Rc::new(Cell::new(false));
        let callback = resize_callback(
            batch.clone(),
            scroll_node,
            row_element.clone(),
            previous_height.clone(),
            ready.clone(),
        );
        let Ok(observer) = ResizeObserver::new(callback.as_ref().unchecked_ref()) else {
            let _ = row_element.remove_attribute("data-resize-anchor-observer");
            return;
        };
        observer.observe(row.as_ref());
        let cleanup = SendWrapper::new(RowResizeObserver {
            observer,
            row: row_element,
            _callback: callback,
        });
        on_cleanup(move || {
            let cleanup = cleanup.take();
            cleanup.observer.disconnect();
            let _ = cleanup.row.remove_attribute("data-resize-anchor-observer");
        });
    });

    #[cfg(not(target_arch = "wasm32"))]
    let _ = (batch, scroll_node, row_node);
}

#[cfg(target_arch = "wasm32")]
fn resize_callback(
    batch: ResizeAnchorBatch,
    scroll_node: NodeRef<Div>,
    row: HtmlElement,
    previous_height: Rc<Cell<i32>>,
    ready: Rc<Cell<bool>>,
) -> Closure<dyn FnMut()> {
    Closure::wrap(Box::new(move || {
        let current_height = row.offset_height().max(0);
        if current_height <= 0 {
            return;
        }
        let _ = row.set_attribute("data-resize-anchor-height", &current_height.to_string());
        if !ready.get() {
            previous_height.set(current_height);
            ready.set(true);
            let _ = row.set_attribute("data-resize-anchor-observer", "ready");
            return;
        }
        let previous = previous_height.get();
        previous_height.set(current_height);
        let delta = current_height - previous;
        if delta == 0 || previous <= 0 {
            return;
        }
        let Some(owner) = scroll_node.get_untracked() else {
            return;
        };
        let row_id = row.get_attribute("data-observed-row-id");
        let current_top = owner.scroll_top().max(0);
        let comparison_top = batch
            .scroll_top_except(row_id.as_deref())
            .unwrap_or(current_top);
        if comparison_top == 0 {
            return;
        }
        let previous_bottom = row_bottom(&owner, &row, previous);
        let current_bottom = row_bottom(&owner, &row, current_height);
        let compensation_top = if delta < 0 && current_bottom <= comparison_top {
            comparison_top.max(previous_bottom)
        } else {
            comparison_top
        };
        if delta > 0 && current_bottom == comparison_top {
            return;
        }
        if previous_bottom <= compensation_top {
            if delta > 0 && batch.restore_anchor_except(&owner, row_id.as_deref()) {
                return;
            }
            let next_top =
                if delta > 0 && previous_bottom < comparison_top && comparison_top < current_bottom
                {
                    current_bottom
                } else {
                    compensation_top.saturating_add(delta).max(0)
                };
            set_scroll_top_after_resize(batch.clone(), owner.into(), next_top);
        }
    }) as Box<dyn FnMut()>)
}

#[cfg(target_arch = "wasm32")]
fn set_scroll_top_after_resize(batch: ResizeAnchorBatch, owner: HtmlElement, scroll_top: i32) {
    batch.suppress_scroll_top(scroll_top);
    set_timeout(
        move || {
            owner.set_scroll_top(scroll_top);
            batch.suppress_scroll_top(owner.scroll_top().max(0));
        },
        Duration::from_millis(0),
    );
}

#[cfg(target_arch = "wasm32")]
fn row_bottom(owner: &HtmlElement, row: &HtmlElement, height: i32) -> i32 {
    let row_top = page_top(row).saturating_sub(page_top(owner));
    row_top.saturating_add(height.max(1))
}

#[cfg(target_arch = "wasm32")]
fn page_top(element: &HtmlElement) -> i32 {
    let mut top = element.offset_top();
    let mut parent = element.offset_parent();
    for _ in 0..16 {
        let Some(next) = parent.and_then(|node| node.dyn_into::<HtmlElement>().ok()) else {
            break;
        };
        top = top.saturating_add(next.offset_top());
        parent = next.offset_parent();
    }
    top
}
