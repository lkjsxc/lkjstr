use std::sync::{Arc, Mutex};
use std::time::Duration;

use leptos::html::Div;
use leptos::prelude::*;
use leptos::web_sys::{Event, HtmlElement};
use lkjstr_app::{FEED_LOAD_OLDER_COMMAND, FeedViewRow, ThreadFeedView, ThreadOlderLoadTrigger};

use crate::workspace::thread_older::ThreadOlderLoader;

const NEAR_END_PX: i32 = 96;

#[derive(Clone, Copy, Debug, Default)]
struct ThreadScrollState {
    last_top: i32,
    was_near_end: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct ThreadScrollSnapshot {
    top: i32,
    scrollable: bool,
    near_end: bool,
}

#[derive(Clone, Copy, Debug, Default)]
struct ThreadViewportFillState {
    last_requested_rows: Option<usize>,
}

pub(super) fn older_scroll_handler(loader: Option<ThreadOlderLoader>) -> impl Fn(Event) + Clone {
    let state = Arc::new(Mutex::new(ThreadScrollState::default()));
    move |event| {
        let Some(loader) = loader.as_ref() else {
            return;
        };
        let element = event_target::<HtmlElement>(&event);
        if should_request_older(&state, scroll_snapshot(&element)) {
            loader.request(ThreadOlderLoadTrigger::Scroll, true, true);
        }
    }
}

pub(super) fn install_viewport_fill_probe(
    scroll_node: NodeRef<Div>,
    loader: Option<ThreadOlderLoader>,
    model: RwSignal<ThreadFeedView>,
) {
    let state = Arc::new(Mutex::new(ThreadViewportFillState::default()));
    Effect::new(move |_| {
        let model = model.get();
        let allows_older = allows_older_request(&model);
        let row_count = model.view_model.rows.len();
        let state = state.clone();
        let loader = loader.clone();
        set_timeout(
            move || {
                let Some(loader) = loader.as_ref() else {
                    return;
                };
                let Some(element) = scroll_node.get() else {
                    return;
                };
                let scrollable = element.scroll_height() > element.client_height();
                if should_request_viewport_fill(&state, allows_older, row_count, scrollable) {
                    loader.request(ThreadOlderLoadTrigger::ViewportFill, false, false);
                }
            },
            Duration::from_millis(0),
        );
    });
}

fn scroll_snapshot(element: &HtmlElement) -> ThreadScrollSnapshot {
    let top = element.scroll_top().max(0);
    let viewport_bottom = top.saturating_add(element.client_height().max(0));
    let scroll_height = element.scroll_height().max(0);
    let distance_to_end = scroll_height.saturating_sub(viewport_bottom);
    ThreadScrollSnapshot {
        top,
        scrollable: scroll_height > element.client_height().max(0),
        near_end: distance_to_end <= NEAR_END_PX,
    }
}

fn should_request_older(
    state: &Arc<Mutex<ThreadScrollState>>,
    snapshot: ThreadScrollSnapshot,
) -> bool {
    let Ok(mut state) = state.lock() else {
        return false;
    };
    let user_scrolled_down = snapshot.top > state.last_top;
    let should_request =
        snapshot.scrollable && user_scrolled_down && snapshot.near_end && !state.was_near_end;
    state.last_top = snapshot.top;
    state.was_near_end = snapshot.near_end;
    should_request
}

fn allows_older_request(model: &ThreadFeedView) -> bool {
    model.view_model.rows.iter().any(|row| match row {
        FeedViewRow::Footer(row) => row.command.as_deref() == Some(FEED_LOAD_OLDER_COMMAND),
        _ => false,
    })
}

fn should_request_viewport_fill(
    state: &Arc<Mutex<ThreadViewportFillState>>,
    allows_older: bool,
    row_count: usize,
    scrollable: bool,
) -> bool {
    if !allows_older || scrollable {
        return false;
    }
    let Ok(mut state) = state.lock() else {
        return false;
    };
    if state.last_requested_rows == Some(row_count) {
        return false;
    }
    state.last_requested_rows = Some(row_count);
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scroll_gate_requests_once_when_downward_scroll_reaches_end() {
        let state = Arc::new(Mutex::new(ThreadScrollState::default()));

        assert!(!should_request_older(
            &state,
            ThreadScrollSnapshot {
                top: 0,
                scrollable: true,
                near_end: false,
            },
        ));
        assert!(should_request_older(
            &state,
            ThreadScrollSnapshot {
                top: 420,
                scrollable: true,
                near_end: true,
            },
        ));
        assert!(!should_request_older(
            &state,
            ThreadScrollSnapshot {
                top: 440,
                scrollable: true,
                near_end: true,
            },
        ));
    }

    #[test]
    fn viewport_fill_gate_requests_once_per_underfilled_row_count() {
        let state = Arc::new(Mutex::new(ThreadViewportFillState::default()));

        assert!(should_request_viewport_fill(&state, true, 3, false));
        assert!(!should_request_viewport_fill(&state, true, 3, false));
        assert!(should_request_viewport_fill(&state, true, 4, false));
        assert!(!should_request_viewport_fill(&state, true, 5, true));
        assert!(!should_request_viewport_fill(&state, false, 6, false));
    }
}
