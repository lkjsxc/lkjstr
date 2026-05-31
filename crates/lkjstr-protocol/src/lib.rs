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
pub mod nip19;
mod nip19_encode;
mod nip19_tlv;
pub mod nip30;
pub mod nip36;
pub mod relay_url;

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
pub use nip19::{
    AddressPointer, EventPointer, Nip19Error, NostrEntity, ProfilePointer, decode_nip19,
};
pub use nip19_encode::{
    encode_naddr, encode_nevent, encode_nip19, encode_note, encode_nprofile, encode_npub,
    encode_nsec,
};
pub use nip30::{
    CustomEmoji, custom_emoji_tag, custom_emoji_tag_parts, custom_emoji_token_text, custom_emojis,
    parse_custom_emoji_input, valid_custom_emoji_address, valid_custom_emoji_shortcode,
    valid_custom_emoji_url, valid_incoming_custom_emoji_shortcode,
};
pub use nip36::{content_warning_reason, content_warning_tag, has_content_warning};
pub use relay_url::normalize_relay_url;
