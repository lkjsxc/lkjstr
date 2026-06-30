use lkjstr_ui::HomeFeedRequest;

use crate::{
    home_feed_follow_relay::start_home_follow_read,
    home_feed_relay::start_home_relay_read,
    home_feed_relay_input::HomeRelayCommand,
    relay_read_handle::RelayReadSlot,
};

pub(crate) fn start_home_relay_command(
    command: HomeRelayCommand,
    request: HomeFeedRequest,
    relay_slot: RelayReadSlot,
) {
    match command {
        HomeRelayCommand::Notes(relay) => start_notes(relay, request, relay_slot),
        HomeRelayCommand::Follow(follow) => {
            let note_slot = relay_slot.clone();
            let note_request = request.clone();
            if let Some(handle) = start_home_follow_read(
                follow,
                move |model| request.complete(model),
                move |notes| start_notes(notes, note_request.clone(), note_slot.clone()),
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
) {
    if request.is_released() {
        return;
    }
    let complete_request = request.clone();
    if let Some(handle) = start_home_relay_read(notes, move |model| {
        complete_request.complete(model);
    }) {
        relay_slot.replace(handle);
    }
}
