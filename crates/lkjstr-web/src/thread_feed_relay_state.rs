use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use crate::thread_feed_relay_input::ThreadRelayReadInput;

#[derive(Clone, Default)]
pub(crate) struct ThreadRelayState {
    inputs: Arc<Mutex<BTreeMap<String, ThreadRelayReadInput>>>,
}

impl ThreadRelayState {
    pub(crate) fn remember(&self, input: ThreadRelayReadInput) {
        if let Ok(mut inputs) = self.inputs.lock() {
            inputs.insert(input.owner.clone(), input);
        }
    }

    pub(crate) fn get(&self, owner: &str) -> Option<ThreadRelayReadInput> {
        self.inputs
            .lock()
            .ok()
            .and_then(|inputs| inputs.get(owner).cloned())
    }

    pub(crate) fn forget(&self, owner: &str) {
        if let Ok(mut inputs) = self.inputs.lock() {
            inputs.remove(owner);
        }
    }
}
