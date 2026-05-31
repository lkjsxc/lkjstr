#![doc = "Bounded relay send queue."]

use std::collections::VecDeque;

pub const fn max_relay_queued_messages() -> usize {
    64
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RelaySendQueue {
    messages: VecDeque<String>,
    max_len: usize,
}

impl Default for RelaySendQueue {
    fn default() -> Self {
        Self::new(max_relay_queued_messages())
    }
}

impl RelaySendQueue {
    #[must_use]
    pub fn new(max_len: usize) -> Self {
        Self {
            messages: VecDeque::new(),
            max_len,
        }
    }

    pub fn enqueue(&mut self, message: impl Into<String>) -> bool {
        if self.messages.len() >= self.max_len {
            return false;
        }
        self.messages.push_back(message.into());
        true
    }

    #[must_use]
    pub fn drain(&mut self) -> Vec<String> {
        self.messages.drain(..).collect()
    }

    #[must_use]
    pub fn has_pending(&self) -> bool {
        !self.messages.is_empty()
    }

    #[must_use]
    pub fn len(&self) -> usize {
        self.messages.len()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.messages.is_empty()
    }

    pub fn clear(&mut self) {
        self.messages.clear();
    }
}
