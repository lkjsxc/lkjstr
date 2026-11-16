use crate::engine::protocol::Delivery;
use serde_json::{Value, json};
pub(super) fn value(d: Delivery) -> Value {
    let mut row = json!({"url":d.relay,"state":match d.state.as_str(){"accepted"=>"ok","rejected"=>"failed",other=>other}});
    if let Some(message) = d.message {
        row["message"] = message.into();
    }
    row
}
