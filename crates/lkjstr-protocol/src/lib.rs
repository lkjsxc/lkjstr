#![doc = "Rust Nostr protocol kernel for lkjstr."]

pub mod bytes;
pub mod error;
pub mod event;
pub mod event_id;
mod event_tags;

pub use bytes::{
    ascii_to_bytes, bytes_to_ascii, bytes_to_hex, bytes_to_utf8, hex_to_bytes, is_lower_hex,
    try_hex_to_bytes, utf8_to_bytes,
};
pub use error::ProtocolError;
pub use event::{
    EventFramePolicy, EventValidationCode, EventValidationError, NostrEvent, NostrTag,
    UnsignedNostrEvent, compare_events_desc, is_event_id, is_pubkey, is_signature,
    parse_nostr_event_json, parse_nostr_event_value, parse_unsigned_event_value,
};
pub use event_id::{compute_event_id, serialize_event};
