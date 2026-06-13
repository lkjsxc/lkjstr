use lkjstr_app::{
    NotificationsOlderIntent, NotificationsOlderIntentInput, plan_notifications_older_intent,
};
use lkjstr_ui::{NotificationsFeedRequest, NotificationsOlderRequest};

use crate::{
    notifications_feed_relay::start_notifications_relay_read,
    notifications_feed_relay_input::{
        notifications_older_cursor_created_at, notifications_older_relay_input_from_state,
    },
    notifications_feed_relay_model::NotificationsRelayReadOutput,
    notifications_feed_relay_state::NotificationsRelayState,
    relay_read_handle::RelayReadSlot,
};

pub(crate) fn release_owner(
    state: NotificationsRelayState,
    owner: String,
    slot: RelayReadSlot,
) -> impl FnOnce() {
    move || {
        slot.cancel();
        state.forget(&owner);
    }
}

pub(crate) fn complete_read_output(
    state: &NotificationsRelayState,
    request: &NotificationsFeedRequest,
    output: NotificationsRelayReadOutput,
) {
    if request.is_released() {
        return;
    }
    state.remember(output.input);
    request.complete(output.model);
}

pub(crate) fn start_older_request(
    state: NotificationsRelayState,
    request: NotificationsOlderRequest,
) {
    let relay_slot = RelayReadSlot::default();
    let release_slot = relay_slot.clone();
    request.lease().on_release(move || release_slot.cancel());
    if request.is_released() {
        return;
    }
    let Some(base) = state.get(&request.owner) else {
        return;
    };
    let Some(cursor) = notifications_older_cursor_created_at(&base) else {
        return;
    };
    let NotificationsOlderIntent::Request { .. } =
        plan_notifications_older_intent(NotificationsOlderIntentInput {
            has_older: base.cache_window.has_older,
            loading_older: false,
            older_cursor_created_at: Some(cursor),
            trigger: request.trigger,
            scrollable: request.scrollable,
            user_scrolled_down: request.user_scrolled_down,
            automatic_empty_requests: 0,
        })
    else {
        return;
    };
    let Some(relay) = notifications_older_relay_input_from_state(&base) else {
        return;
    };
    state.remember(relay.clone());
    if let Some(handle) = start_notifications_relay_read(relay, move |output| {
        if request.is_released() {
            return;
        }
        state.remember(output.input);
        request.complete(output.model);
    }) {
        relay_slot.replace(handle);
    }
}
