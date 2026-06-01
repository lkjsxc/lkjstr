use lkjstr_protocol::{EventFramePolicy, MessageErrorCode, RelayMessage, parse_relay_message};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RelaySocketMessage {
    Relay(RelayMessage),
    ParseError {
        code: MessageErrorCode,
        message: String,
    },
}

#[must_use]
pub fn parse_socket_text(raw: &str, policy: Option<&EventFramePolicy>) -> RelaySocketMessage {
    match parse_relay_message(raw, policy) {
        Ok(message) => RelaySocketMessage::Relay(message),
        Err(error) => RelaySocketMessage::ParseError {
            code: error.code,
            message: error.message,
        },
    }
}
