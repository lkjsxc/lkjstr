#![doc = "Relay browser host adapters."]

mod message;
mod problem;
mod socket;
mod timer;

pub use message::{RelaySocketMessage, parse_socket_text};
pub use problem::{RelayHostProblem, RelayHostProblemKind, RelayHostResult};
pub use socket::{RelaySocketCallbacks, RelaySocketEvent, RelaySocketHandle};
pub use timer::BrowserTimeout;
