use crate::client::message_state::RelayMessageState;
use crate::send_queue::RelaySendQueue;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RelayConnectionState {
    Idle,
    Connecting,
    Open,
    Closed,
    Error,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RelayClientState {
    pub(super) connection: RelayConnectionState,
    pub(super) queue: RelaySendQueue,
    pub(super) reconnect_attempts: u32,
    pub(super) final_closed: bool,
    pub(super) last_problem: Option<String>,
    pub(super) messages: RelayMessageState,
}

impl Default for RelayClientState {
    fn default() -> Self {
        Self {
            connection: RelayConnectionState::Idle,
            queue: RelaySendQueue::default(),
            reconnect_attempts: 0,
            final_closed: false,
            last_problem: None,
            messages: RelayMessageState::default(),
        }
    }
}

impl RelayClientState {
    #[must_use]
    pub fn connection(&self) -> RelayConnectionState {
        self.connection
    }

    #[must_use]
    pub fn queued_len(&self) -> usize {
        self.queue.len()
    }

    #[must_use]
    pub fn reconnect_attempts(&self) -> u32 {
        self.reconnect_attempts
    }

    #[must_use]
    pub fn final_closed(&self) -> bool {
        self.final_closed
    }

    #[must_use]
    pub fn last_problem(&self) -> Option<&str> {
        self.last_problem.as_deref()
    }

    #[must_use]
    pub fn messages(&self) -> &RelayMessageState {
        &self.messages
    }
}
