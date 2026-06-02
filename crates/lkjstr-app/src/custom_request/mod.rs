#![doc = "Pure Custom Request parser and classifiers."]

mod mode;
mod parse;
mod types;

pub use mode::custom_request_mode;
pub use parse::parse_custom_request;
pub use types::{CustomRequest, CustomRequestError, CustomRequestErrorKind, CustomRequestMode};
