use lkjstr_ui::HomeFeedRequest;

use crate::{
    home_feed_follow_relay::start_home_follow_read,
    home_feed_relay::start_home_relay_read,
    home_feed_relay_input::HomeRelayCommand,
    relay_read_handle::RelayReadSlot,
    home_feed_relay_state::HomeRelayState,
};

pub(crate) fn start_home_relay_command(
    command: HomeRelayCommand,
    request: HomeFeedRequest,
    relay_slot: RelayReadSlot,
    state: HomeRelayState,
    generation: u64,
) {
    match command {
        HomeRelayCommand::Notes(relay) => start_notes(relay, request, relay_slot, state, generation),
        HomeRelayCommand::Follow(follow) => {
            let note_slot = relay_slot.clone();
            let note_request = request.clone();
            let note_state = state.clone();
            if let Some(handle) = start_home_follow_read(
                follow,
                move |model| {
                    if state.is_current(&request.owner, generation) { request.complete(model); }
                },
                move |notes| start_notes(notes, note_request.clone(), note_slot.clone(), note_state.clone(), generation),
            ) {
                relay_slot.replace(handle);
            }
        }
    }
}

fn start_notes(
    notes: crate::home_feed_relay_input::HomeRelayReadInput,
    request: HomeFeedRequest,
    relay_slot: RelayReadSlot,
    state: HomeRelayState,
    generation: u64,
) {
    if request.is_released() || !state.remember(generation, notes.clone(), true) {
        return;
    }
    let complete_request = request.clone();
    if let Some(handle) = start_home_relay_read(notes, move |output| {
        if !complete_request.is_released()
            && state.remember(generation, output.input, !output.finished)
        {
            complete_request.complete(output.model);
        }
    }) {
        relay_slot.replace(handle);
    }
}

pub(crate) fn start_home_older_request(state: HomeRelayState, request: HomeFeedRequest) {
    let Some((generation, input, slot)) = state.start_older(&request) else {
        request.lease().release();
        return;
    };
    let release_state = state.clone();
    let owner = request.owner.clone();
    let release_slot = slot.clone();
    request.lease().on_release(move || {
        release_slot.cancel();
        release_state.finish(&owner, generation);
    });
    let complete_request = request.clone();
    match start_home_relay_read(input, move |output| {
        if complete_request.is_released()
            || !state.remember(generation, output.input, true)
        {
            return;
        }
        complete_request.complete(output.model);
        if output.finished { complete_request.lease().release(); }
    }) {
        Some(handle) => slot.replace(handle),
        None => request.lease().release(),
    }
}
