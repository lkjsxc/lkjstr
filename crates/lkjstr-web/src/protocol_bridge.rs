use lkjstr_protocol::{
    EventValidationCode, MessageErrorCode, NostrEntity, RelayMessage, VerificationCode,
    VerificationResult, decode_nip19, encode_client_message, encode_nip19,
    parse_client_message_value, parse_nostr_event_json, parse_relay_message, verify_event,
};
use serde::Serialize;
use serde_json::Value;
use wasm_bindgen::prelude::JsValue;

use crate::response;

#[derive(Serialize)]
#[serde(tag = "type")]
enum RelayMessageDto {
    #[serde(rename = "EVENT")]
    Event {
        subscription_id: String,
        event: lkjstr_protocol::NostrEvent,
    },
    #[serde(rename = "OK")]
    Ok {
        event_id: String,
        accepted: bool,
        message: String,
    },
    #[serde(rename = "EOSE")]
    Eose { subscription_id: String },
    #[serde(rename = "CLOSED")]
    Closed {
        subscription_id: String,
        message: String,
    },
    #[serde(rename = "NOTICE")]
    Notice { message: String },
    #[serde(rename = "AUTH")]
    Auth { challenge: String },
}

pub fn validate_event_json(json: &str) -> JsValue {
    match parse_nostr_event_json(json, None) {
        Ok(event) => response::ok(event),
        Err(error) => response::error(event_code(&error.code), error.message),
    }
}

pub fn verify_event_json(json: &str) -> JsValue {
    match parse_nostr_event_json(json, None) {
        Ok(event) => verified_response(&event),
        Err(error) => response::error(event_code(&error.code), error.message),
    }
}

pub fn encode_client_message_json(json: &str) -> Result<String, JsValue> {
    let value = serde_json::from_str::<Value>(json)
        .map_err(|error| response::error("bad_json", error.to_string()))?;
    let message = parse_client_message_value(&value)
        .ok_or_else(|| response::error("bad_shape", "client message shape is invalid"))?;
    encode_client_message(&message).map_err(|error| response::error("bad_shape", error.to_string()))
}

pub fn decode_relay_message_json(json: &str) -> JsValue {
    match parse_relay_message(json, None) {
        Ok(message) => response::ok(relay_dto(message)),
        Err(error) => response::error(message_code(&error.code), error.message),
    }
}

pub fn decode_nip19_json(text: &str) -> JsValue {
    match decode_nip19(text) {
        Some(entity) => response::ok(entity),
        None => response::error("invalid_entity", "NIP-19 entity is invalid"),
    }
}

pub fn encode_nip19_json(json: &str) -> Result<String, JsValue> {
    let entity = serde_json::from_str::<NostrEntity>(json)
        .map_err(|error| response::error("bad_json", error.to_string()))?;
    encode_nip19(&entity).map_err(|error| response::error(nip19_code(&error), format!("{error:?}")))
}

fn verified_response(event: &lkjstr_protocol::NostrEvent) -> JsValue {
    match verify_event(event) {
        VerificationResult::Ok(event) => response::ok(event),
        VerificationResult::Err { code, message } => response::error(verify_code(&code), message),
    }
}

fn relay_dto(message: RelayMessage) -> RelayMessageDto {
    match message {
        RelayMessage::Event {
            subscription_id,
            event,
        } => RelayMessageDto::Event {
            subscription_id,
            event,
        },
        RelayMessage::Ok {
            event_id,
            accepted,
            message,
        } => RelayMessageDto::Ok {
            event_id,
            accepted,
            message,
        },
        RelayMessage::Eose(subscription_id) => RelayMessageDto::Eose { subscription_id },
        RelayMessage::Closed {
            subscription_id,
            message,
        } => RelayMessageDto::Closed {
            subscription_id,
            message,
        },
        RelayMessage::Notice(message) => RelayMessageDto::Notice { message },
        RelayMessage::Auth(challenge) => RelayMessageDto::Auth { challenge },
    }
}

fn event_code(code: &EventValidationCode) -> &'static str {
    match code {
        EventValidationCode::NotObject => "not_object",
        EventValidationCode::BadField => "bad_field",
        EventValidationCode::BadTag => "bad_tag",
    }
}

fn message_code(code: &MessageErrorCode) -> &'static str {
    match code {
        MessageErrorCode::BadJson => "bad_json",
        MessageErrorCode::BadShape => "bad_shape",
        MessageErrorCode::BadEvent => "bad_event",
        MessageErrorCode::BadFilter => "bad_filter",
    }
}

fn verify_code(code: &VerificationCode) -> &'static str {
    match code {
        VerificationCode::IdMismatch => "id_mismatch",
        VerificationCode::BadSignature => "bad_signature",
    }
}

fn nip19_code(error: &lkjstr_protocol::Nip19Error) -> &'static str {
    match error {
        lkjstr_protocol::Nip19Error::InvalidEntity => "invalid_entity",
        lkjstr_protocol::Nip19Error::InvalidPrefix => "invalid_prefix",
        lkjstr_protocol::Nip19Error::InvalidHex => "invalid_hex",
        lkjstr_protocol::Nip19Error::InvalidTlv => "invalid_tlv",
    }
}
