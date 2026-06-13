use lkjstr_app::{ThreadOlderIntent, ThreadOlderIntentInput, plan_thread_older_intent};
use lkjstr_ui::{ThreadFeedRequest, ThreadOlderRequest};

use crate::{
    host_status::browser_now_ms,
    relay_read_handle::RelayReadSlot,
    thread_feed_relay::start_thread_relay_read,
    thread_feed_relay_input::{
        thread_older_cursor_created_at, thread_older_relay_input_from_state,
    },
    thread_feed_relay_live::thread_live_relay_input_from_state,
    thread_feed_relay_model::ThreadRelayReadOutput,
    thread_feed_relay_state::ThreadRelayState,
};

pub(crate) fn release_owner(
    state: ThreadRelayState,
    owner: String,
    slot: RelayReadSlot,
) -> impl FnOnce() {
    move || {
        slot.cancel();
        state.forget(&owner);
    }
}

pub(crate) fn complete_read_output(
    state: &ThreadRelayState,
    request: &ThreadFeedRequest,
    output: ThreadRelayReadOutput,
    slot: &RelayReadSlot,
) {
    if request.is_released() {
        return;
    }
    let start_live = output.start_live;
    state.remember(output.input.clone());
    request.complete(output.model);
    if !start_live || request.is_released() {
        return;
    }
    let Some(live) = thread_live_relay_input_from_state(&output.input, browser_now_ms() / 1_000)
    else {
        return;
    };
    state.remember(live.clone());
    let state = state.clone();
    let request = request.clone();
    let callback_slot = slot.clone();
    if let Some(handle) = start_thread_relay_read(live, move |output| {
        complete_read_output(&state, &request, output, &callback_slot);
    }) {
        slot.replace(handle);
    }
}

pub(crate) fn start_older_request(state: ThreadRelayState, request: ThreadOlderRequest) {
    let relay_slot = RelayReadSlot::default();
    let release_slot = relay_slot.clone();
    request.lease().on_release(move || release_slot.cancel());
    if request.is_released() {
        return;
    }
    let Some(base) = state.get(&request.owner) else {
        return;
    };
    let Some(cursor) = thread_older_cursor_created_at(&base) else {
        return;
    };
    let ThreadOlderIntent::Request { .. } = plan_thread_older_intent(ThreadOlderIntentInput {
        has_older: base.cache_window.has_older,
        loading_older: false,
        older_cursor_created_at: Some(cursor),
        trigger: request.trigger,
        scrollable: request.scrollable,
        user_scrolled_down: request.user_scrolled_down,
        automatic_empty_requests: 0,
    }) else {
        return;
    };
    let Some(relay) = thread_older_relay_input_from_state(&base) else {
        return;
    };
    state.remember(relay.clone());
    if let Some(handle) = start_thread_relay_read(relay, move |output| {
        if request.is_released() {
            return;
        }
        state.remember(output.input.clone());
        request.complete(output.model);
    }) {
        relay_slot.replace(handle);
    }
}
