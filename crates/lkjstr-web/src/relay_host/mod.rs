#![doc = "Relay browser host adapters."]

mod effect_action;
mod effect_runner;
mod message;
mod problem;
mod socket;
mod timer;

pub use effect_action::{
    RelayHostAction, RelayHostEffectContext, RelayHostEvent, RelayHostEventOutcome, RelayHostOwner,
};
pub use effect_runner::RelayEffectRunner;
pub use message::{RelaySocketMessage, parse_socket_text};
pub use problem::{RelayHostProblem, RelayHostProblemKind, RelayHostResult};
pub use socket::{RelaySocketCallbacks, RelaySocketEvent, RelaySocketHandle};
pub use timer::BrowserTimeout;
