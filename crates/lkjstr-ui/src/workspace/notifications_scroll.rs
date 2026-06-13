use std::sync::{Arc, Mutex};

use leptos::prelude::*;
use leptos::web_sys::{Event, HtmlElement};
use lkjstr_app::NotificationsOlderLoadTrigger;

use crate::workspace::notifications_older::NotificationsOlderLoader;

const NEAR_END_PX: i32 = 96;

#[derive(Clone, Copy, Debug, Default)]
struct NotificationsScrollState {
    last_top: i32,
    was_near_end: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct NotificationsScrollSnapshot {
    top: i32,
    scrollable: bool,
    near_end: bool,
}

pub(super) fn older_scroll_handler(
    loader: Option<NotificationsOlderLoader>,
) -> impl Fn(Event) + Clone {
    let state = Arc::new(Mutex::new(NotificationsScrollState::default()));
    move |event| {
        let Some(loader) = loader.as_ref() else {
            return;
        };
        let element = event_target::<HtmlElement>(&event);
        if should_request_older(&state, scroll_snapshot(&element)) {
            loader.request(NotificationsOlderLoadTrigger::Scroll, true, true);
        }
    }
}

fn scroll_snapshot(element: &HtmlElement) -> NotificationsScrollSnapshot {
    let top = element.scroll_top().max(0);
    let viewport_bottom = top.saturating_add(element.client_height().max(0));
    let scroll_height = element.scroll_height().max(0);
    let distance_to_end = scroll_height.saturating_sub(viewport_bottom);
    NotificationsScrollSnapshot {
        top,
        scrollable: scroll_height > element.client_height().max(0),
        near_end: distance_to_end <= NEAR_END_PX,
    }
}

fn should_request_older(
    state: &Arc<Mutex<NotificationsScrollState>>,
    snapshot: NotificationsScrollSnapshot,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scroll_gate_requests_once_when_downward_scroll_reaches_end() {
        let state = Arc::new(Mutex::new(NotificationsScrollState::default()));

        assert!(!should_request_older(
            &state,
            NotificationsScrollSnapshot {
                top: 0,
                scrollable: true,
                near_end: false,
            },
        ));
        assert!(should_request_older(
            &state,
            NotificationsScrollSnapshot {
                top: 420,
                scrollable: true,
                near_end: true,
            },
        ));
        assert!(!should_request_older(
            &state,
            NotificationsScrollSnapshot {
                top: 440,
                scrollable: true,
                near_end: true,
            },
        ));
    }
}
