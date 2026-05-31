use serde_json::{Value, json};

use crate::{
    EventFramePolicy, NostrEvent, NostrFilter, ProtocolError,
    filter::filter_to_value,
    message_parts::{bool_at, error, one_string, parse_error, string_at, two_strings},
    parse_filter_value, parse_nostr_event_value,
};

#[derive(Debug, Clone, Eq, PartialEq)]
pub enum ClientMessage {
    Event(NostrEvent),
    Req {
        subscription_id: String,
        filters: Vec<NostrFilter>,
    },
    Close(String),
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub enum RelayMessage {
    Event {
        subscription_id: String,
        event: NostrEvent,
    },
    Ok {
        event_id: String,
        accepted: bool,
        message: String,
    },
    Eose(String),
    Closed {
        subscription_id: String,
        message: String,
    },
    Notice(String),
    Auth(String),
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub enum MessageErrorCode {
    BadJson,
    BadShape,
    BadEvent,
    BadFilter,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct MessageParseError {
    pub code: MessageErrorCode,
    pub message: String,
}

pub fn encode_client_message(message: &ClientMessage) -> Result<String, ProtocolError> {
    let value = match message {
        ClientMessage::Event(event) => json!(["EVENT", event]),
        ClientMessage::Close(subscription_id) => json!(["CLOSE", subscription_id]),
        ClientMessage::Req {
            subscription_id,
            filters,
        } => {
            let mut values = vec![json!("REQ"), json!(subscription_id)];
            values.extend(filters.iter().map(filter_to_value));
            Value::Array(values)
        }
    };
    serde_json::to_string(&value).map_err(|error| ProtocolError::Json(error.to_string()))
}

pub fn parse_relay_message(
    raw: &str,
    policy: Option<&EventFramePolicy>,
) -> Result<RelayMessage, MessageParseError> {
    let value =
        serde_json::from_str(raw).map_err(|_| parse_error(MessageErrorCode::BadJson, ""))?;
    let Value::Array(items) = value else {
        return error(MessageErrorCode::BadShape, "relay message must be an array");
    };
    let Some(kind) = string_at(&items, 0) else {
        return error(MessageErrorCode::BadShape, "relay message must be an array");
    };
    match kind.as_str() {
        "EVENT" => parse_relay_event(&items, policy),
        "OK" => parse_ok(&items),
        "EOSE" => one_string(&items, RelayMessage::Eose, "EOSE"),
        "CLOSED" => two_strings(
            &items,
            |subscription_id, message| RelayMessage::Closed {
                subscription_id,
                message,
            },
            "CLOSED",
        ),
        "NOTICE" => one_string(&items, RelayMessage::Notice, "NOTICE"),
        "AUTH" => one_string(&items, RelayMessage::Auth, "AUTH"),
        other => error(
            MessageErrorCode::BadShape,
            format!("unsupported relay message {other}"),
        ),
    }
}

pub fn parse_client_message_value(value: &Value) -> Option<ClientMessage> {
    let Value::Array(items) = value else {
        return None;
    };
    let kind = string_at(items, 0)?;
    match kind.as_str() {
        "EVENT" if items.len() == 2 => {
            let event = parse_nostr_event_value(items.get(1)?, None).ok()?;
            Some(ClientMessage::Event(event))
        }
        "CLOSE" if items.len() == 2 => Some(ClientMessage::Close(string_at(items, 1)?)),
        "REQ" if items.len() >= 3 => parse_client_req(items),
        _ => None,
    }
}

fn parse_client_req(items: &[Value]) -> Option<ClientMessage> {
    let subscription_id = string_at(items, 1)?;
    let filters = items
        .iter()
        .skip(2)
        .map(parse_filter_value)
        .collect::<Option<Vec<_>>>()?;
    Some(ClientMessage::Req {
        subscription_id,
        filters,
    })
}

fn parse_relay_event(
    items: &[Value],
    policy: Option<&EventFramePolicy>,
) -> Result<RelayMessage, MessageParseError> {
    if items.len() != 3 {
        return error(MessageErrorCode::BadShape, "EVENT message shape is invalid");
    }
    let Some(subscription_id) = string_at(items, 1) else {
        return error(MessageErrorCode::BadShape, "EVENT message shape is invalid");
    };
    let Some(value) = items.get(2) else {
        return error(MessageErrorCode::BadShape, "EVENT message shape is invalid");
    };
    let event = parse_nostr_event_value(value, policy)
        .map_err(|error| parse_error(MessageErrorCode::BadEvent, error.message))?;
    Ok(RelayMessage::Event {
        subscription_id,
        event,
    })
}

fn parse_ok(items: &[Value]) -> Result<RelayMessage, MessageParseError> {
    if items.len() != 4 {
        return error(MessageErrorCode::BadShape, "OK message has invalid length");
    }
    let (Some(event_id), Some(accepted), Some(message)) =
        (string_at(items, 1), bool_at(items, 2), string_at(items, 3))
    else {
        return error(MessageErrorCode::BadShape, "OK field is invalid");
    };
    Ok(RelayMessage::Ok {
        event_id,
        accepted,
        message,
    })
}
