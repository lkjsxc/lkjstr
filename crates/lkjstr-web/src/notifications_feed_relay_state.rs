use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use crate::notifications_feed_relay_input::NotificationsRelayReadInput;

#[derive(Clone, Default)]
pub(crate) struct NotificationsRelayState {
    inputs: Arc<Mutex<BTreeMap<String, NotificationsRelayReadInput>>>,
}

impl NotificationsRelayState {
    pub(crate) fn remember(&self, input: NotificationsRelayReadInput) {
        if let Ok(mut inputs) = self.inputs.lock() {
            inputs.insert(input.owner.clone(), input);
        }
    }

    pub(crate) fn get(&self, owner: &str) -> Option<NotificationsRelayReadInput> {
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
