use lkjstr_app::{GlobalOlderIntent, GlobalOlderIntentInput, plan_global_older_intent};
use lkjstr_ui::{GlobalFeedRequest, GlobalOlderRequest};

use crate::{
    global_feed_relay::start_global_relay_read,
    global_feed_relay_input::global_older_relay_input_from_state,
    global_feed_relay_model::GlobalRelayReadOutput,
    global_feed_relay_state::GlobalRelayState,
    relay_read_handle::RelayReadSlot,
};

pub(crate) fn release_owner(
    state: GlobalRelayState,
    owner: String,
    slot: RelayReadSlot,
) -> impl FnOnce() {
    move || {
        slot.cancel();
        state.forget(&owner);
    }
}

pub(crate) fn complete_read_output(
    state: &GlobalRelayState,
    request: &GlobalFeedRequest,
    output: GlobalRelayReadOutput,
) {
    if request.is_released() {
        return;
    }
    state.remember(output.input);
    request.complete(output.model);
}

pub(crate) fn start_older_request(state: GlobalRelayState, request: GlobalOlderRequest) {
    let relay_slot = RelayReadSlot::default();
    let release_slot = relay_slot.clone();
    request.lease().on_release(move || release_slot.cancel());
    if request.is_released() {
        return;
    }
    let Some(base) = state.get(&request.owner) else {
        return;
    };
    let Some(cursor) = base.cache_window.oldest_cursor.clone() else {
        return;
    };
    let GlobalOlderIntent::Request { .. } = plan_global_older_intent(GlobalOlderIntentInput {
        has_older: base.cache_window.has_older,
        loading_older: false,
        older_cursor_created_at: Some(cursor.created_at),
        trigger: request.trigger,
        scrollable: request.scrollable,
        user_scrolled_down: request.user_scrolled_down,
        automatic_empty_requests: 0,
    }) else {
        return;
    };
    let Some(relay) = global_older_relay_input_from_state(&base) else {
        return;
    };
    state.remember(relay.clone());
    if let Some(handle) = start_global_relay_read(relay, move |output| {
        if request.is_released() {
            return;
        }
        state.remember(output.input);
        request.complete(output.model);
    }) {
        relay_slot.replace(handle);
    }
}
