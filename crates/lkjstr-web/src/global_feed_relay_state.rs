use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use crate::global_feed_relay_input::GlobalRelayReadInput;

#[derive(Clone, Default)]
pub(crate) struct GlobalRelayState {
    inputs: Arc<Mutex<BTreeMap<String, GlobalRelayReadInput>>>,
}

impl GlobalRelayState {
    pub(crate) fn remember(&self, input: GlobalRelayReadInput) {
        if let Ok(mut inputs) = self.inputs.lock() {
            inputs.insert(input.owner.clone(), input);
        }
    }

    pub(crate) fn get(&self, owner: &str) -> Option<GlobalRelayReadInput> {
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
