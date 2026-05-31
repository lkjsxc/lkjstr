#![doc = "Rust Nostr protocol kernel for lkjstr."]

pub mod bytes;
pub mod crypto;
pub mod error;
pub mod event;
pub mod event_id;
pub mod event_sign;
mod event_tags;
pub mod event_verify;
pub mod filter;
mod message_parts;
pub mod messages;

pub use bytes::{
    ascii_to_bytes, bytes_to_ascii, bytes_to_hex, bytes_to_utf8, hex_to_bytes, is_lower_hex,
    try_hex_to_bytes, utf8_to_bytes,
};
pub use crypto::{
    CryptoError, SecretKeyBytes, generate_secret_key, parse_secret_key_hex, public_key_from_secret,
    public_key_from_secret_hex, sign_schnorr_hex, sign_schnorr_hex_with_secret_hex,
    verify_schnorr_hex,
};
pub use error::ProtocolError;
pub use event::{
    EventFramePolicy, EventValidationCode, EventValidationError, NostrEvent, NostrTag,
    UnsignedNostrEvent, compare_events_desc, is_event_id, is_pubkey, is_signature,
    parse_nostr_event_json, parse_nostr_event_value, parse_unsigned_event_value,
};
pub use event_id::{compute_event_id, serialize_event};
pub use event_sign::{EventTemplate, SignError, finalize_event, sign_event_with_secret_hex};
pub use event_verify::{VerificationCode, VerificationResult, verify_event};
pub use filter::{NostrFilter, matches_any_filter, matches_filter, parse_filter_value};
pub use messages::{
    ClientMessage, MessageErrorCode, MessageParseError, RelayMessage, encode_client_message,
    parse_client_message_value, parse_relay_message,
};
