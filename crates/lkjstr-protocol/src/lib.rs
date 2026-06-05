#![doc = "Rust Nostr protocol kernel for lkjstr."]

pub mod blossom;
pub mod bytes;
pub mod client_tag;
pub mod content_tags;
pub mod crypto;
pub mod error;
pub mod event;
pub mod event_builders;
pub mod event_id;
pub mod event_sign;
mod event_tags;
pub mod event_verify;
pub mod filter;
pub mod follow_list;
pub mod groups;
pub mod kinds;
mod message_parts;
pub mod messages;
pub mod nip19;
mod nip19_encode;
mod nip19_tlv;
pub mod nip30;
pub mod nip36;
pub mod nip51;
pub mod nip57;
pub mod nip65;
pub mod nip96;
pub mod nip98;
pub mod public_chat;
mod public_chat_metadata;
pub mod reactions;
pub mod relay_url;
pub mod tags;

pub use blossom::{
    BlossomAuthInput, BlossomBlobDescriptor, blossom_upload_auth_event, blossom_upload_endpoint,
    parse_blossom_blob_descriptor_value,
};
pub use bytes::{
    ascii_to_bytes, bytes_to_ascii, bytes_to_hex, bytes_to_utf8, hex_to_bytes, is_lower_hex,
    try_hex_to_bytes, utf8_to_bytes,
};
pub use client_tag::{
    ClientTag, ClientTagConfig, ClientTagError, ClientTagPolicy, append_client_tag, client_tag,
    client_tag_allowed_for_kind, client_tag_parts, parse_client_tag,
};
pub use content_tags::{content_derived_tags, emoji_tags, mention_tags};
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
pub use event_builders::{
    ZapRequestInput, parent_event_id, reaction_tags, reply_tags, repost_kind, repost_tags,
    zap_request_tags,
};
pub use event_id::{compute_event_id, serialize_event};
pub use event_sign::{EventTemplate, SignError, finalize_event, sign_event_with_secret_hex};
pub use event_verify::{VerificationCode, VerificationResult, verify_event};
pub use filter::{NostrFilter, matches_any_filter, matches_filter, parse_filter_value};
pub use follow_list::{
    FollowEntry, dedupe_follow_entries, follow_entries_from_event, following_count,
};
pub use groups::{
    GroupAdmin, GroupMember, GroupMetadata, GroupParseError, GroupPreviousRef, GroupReference,
    GroupRole, group_admins_from_event, group_id_from_h_tag, group_members_from_event,
    group_metadata_from_event, group_previous_refs, group_roles_from_event,
    group_state_id_from_d_tag, group_user_event_filter, group_user_list_from_event,
    is_group_moderation_kind, is_group_state_kind,
};
pub use kinds::{
    KIND_BLOSSOM_AUTH, KIND_CHANNEL_CREATE, KIND_CHANNEL_HIDE_MESSAGE, KIND_CHANNEL_MESSAGE,
    KIND_CHANNEL_METADATA, KIND_CHANNEL_MUTE_USER, KIND_DELETION, KIND_EMOJI_LIST, KIND_EMOJI_SET,
    KIND_FOLLOW_LIST, KIND_GENERIC_REPOST, KIND_GROUP_ADMINS, KIND_GROUP_CLOSE_REPORT,
    KIND_GROUP_CREATE_GROUP, KIND_GROUP_CREATE_INVITE, KIND_GROUP_DELETE_EVENT,
    KIND_GROUP_DELETE_GROUP, KIND_GROUP_EDIT_METADATA, KIND_GROUP_JOIN_REQUEST,
    KIND_GROUP_LEAVE_REQUEST, KIND_GROUP_LIVEKIT_PARTICIPANTS, KIND_GROUP_MEMBERS,
    KIND_GROUP_METADATA, KIND_GROUP_PUT_USER, KIND_GROUP_REMOVE_USER, KIND_GROUP_ROLES,
    KIND_HANDLER_INFORMATION, KIND_HANDLER_RECOMMENDATION, KIND_HTTP_AUTH, KIND_METADATA,
    KIND_REACTION, KIND_RECOMMEND_RELAY, KIND_RELAY_AUTH, KIND_RELAY_LIST_METADATA, KIND_REPOST,
    KIND_TEXT_NOTE, KIND_USER_GROUPS, KIND_ZAP_RECEIPT, KIND_ZAP_REQUEST, is_addressable_kind,
    is_ephemeral_kind, is_replaceable_kind,
};
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
pub use nip51::{
    EmojiAddress, account_emoji_source, custom_emojis_from_event, dedupe_custom_emoji_by_shortcode,
    emoji_addresses_from_lists, emoji_set_address, newest_event, newest_events_by_address,
};
pub use nip57::{
    ZapReceiptGroup, ZapTarget, group_zap_receipts, split_zap_amounts, zap_receipt_amount_msats,
    zap_target_event_id, zap_targets,
};
pub use nip65::{RelayListSuggestion, parse_relay_list_suggestions};
pub use nip96::{
    Nip96Server, Nip96UploadResult, nip96_discovery_url, parse_nip96_server_value,
    parse_nip96_upload_result_value, valid_https_url,
};
pub use nip98::{HttpAuthInput, http_auth_event, nostr_authorization_header};
pub use public_chat::{
    ChannelMetadata, ChannelMetadataUpdate, PublicChatError, channel_message_reply_tags,
    channel_message_root_tag, channel_reply_event_id, channel_root_event_id, hide_message_target,
    is_public_chat_kind, mute_user_target, parse_channel_create_metadata,
    parse_channel_metadata_update,
};
pub use reactions::{
    ParsedReaction, ReactionKind, custom_emoji_reaction, custom_emoji_reaction_content,
    custom_emoji_reaction_shortcode, parse_reaction, reaction_content, reaction_target_event_id,
};
pub use relay_url::normalize_relay_url;
pub use tags::{IndexedTags, first_tag_value, index_tags, reply_parent, reply_root, tag_values};
