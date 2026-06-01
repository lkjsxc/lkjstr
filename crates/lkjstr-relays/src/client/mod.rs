#![doc = "Pure relay client lifecycle reducer."]

mod effect;
mod event;
mod message;
mod message_state;
mod reducer;
mod state;
mod transition;

pub use effect::{
    RelayClientDiagnosticKind, RelayClientEffect, RelayTimerKind, connect_deadline_ms,
    reconnect_base_delay_ms, reconnect_max_delay_ms,
};
pub use event::RelayClientEvent;
pub use message_state::{RelayMessageState, max_relay_message_records};
pub use reducer::reduce_relay_client;
pub use state::{RelayClientState, RelayConnectionState};
pub use transition::reconnect_delay_ms;
