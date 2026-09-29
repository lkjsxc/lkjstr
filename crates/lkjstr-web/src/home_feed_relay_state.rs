use std::{collections::BTreeMap, sync::{Arc, Mutex}};
use lkjstr_ui::HomeFeedRequest;
use crate::{home_feed_relay_input::HomeRelayReadInput, relay_read_handle::RelayReadSlot};

#[derive(Clone, Default)]
pub(crate) struct HomeRelayState(Arc<Mutex<HomeOwners>>);

#[derive(Default)]
struct HomeOwners {
    generation: u64,
    entries: BTreeMap<String, HomeOwner>,
}

struct HomeOwner {
    generation: u64,
    input: Option<HomeRelayReadInput>,
    busy: bool,
    slot: RelayReadSlot,
    older: Option<HomeFeedRequest>,
}

impl HomeRelayState {
    pub(crate) fn open(&self, owner: &str, slot: RelayReadSlot) -> Option<u64> {
        let (generation, previous) = {
            let mut state = self.0.lock().ok()?;
            state.generation = state.generation.checked_add(1)?;
            let generation = state.generation;
            let previous = state.entries.insert(owner.to_owned(), HomeOwner {
                generation, input: None, busy: true, slot, older: None,
            });
            (generation, previous)
        };
        if let Some(previous) = previous { close(previous); }
        Some(generation)
    }

    pub(crate) fn is_current(&self, owner: &str, generation: u64) -> bool {
        self.0.lock().ok().is_some_and(|state| {
            state.entries.get(owner).is_some_and(|entry| entry.generation == generation)
        })
    }

    pub(crate) fn remember(&self, generation: u64, input: HomeRelayReadInput, busy: bool) -> bool {
        let Ok(mut state) = self.0.lock() else { return false; };
        let Some(entry) = state.entries.get_mut(&input.owner) else { return false; };
        if entry.generation != generation { return false; }
        entry.input = Some(input);
        entry.busy = busy;
        true
    }

    pub(crate) fn start_older(&self, request: &HomeFeedRequest) -> Option<(u64, HomeRelayReadInput, RelayReadSlot)> {
        let mut state = self.0.lock().ok()?;
        let entry = state.entries.get_mut(&request.owner)?;
        if entry.busy || request.is_released() { return None; }
        let mut input = entry.input.clone()?;
        input.cache_window.oldest_cursor.as_ref()?;
        input.older = true;
        entry.busy = true;
        entry.older = Some(request.clone());
        Some((entry.generation, input, entry.slot.clone()))
    }

    pub(crate) fn finish(&self, owner: &str, generation: u64) {
        let Ok(mut state) = self.0.lock() else { return; };
        if let Some(entry) = state.entries.get_mut(owner)
            && entry.generation == generation
        {
            entry.busy = false;
            entry.older = None;
        }
    }

    pub(crate) fn forget(&self, owner: &str, generation: u64) {
        let previous = {
            let Ok(mut state) = self.0.lock() else { return; };
            if !state.entries.get(owner).is_some_and(|entry| entry.generation == generation) {
                return;
            }
            state.entries.remove(owner)
        };
        if let Some(previous) = previous { close(previous); }
    }
}

fn close(entry: HomeOwner) {
    entry.slot.cancel();
    if let Some(request) = entry.older { request.lease().release(); }
}
