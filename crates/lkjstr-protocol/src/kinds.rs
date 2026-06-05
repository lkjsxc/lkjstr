pub const KIND_METADATA: u64 = 0;
pub const KIND_TEXT_NOTE: u64 = 1;
pub const KIND_RECOMMEND_RELAY: u64 = 2;
pub const KIND_FOLLOW_LIST: u64 = 3;
pub const KIND_DELETION: u64 = 5;
pub const KIND_REPOST: u64 = 6;
pub const KIND_REACTION: u64 = 7;
pub const KIND_GENERIC_REPOST: u64 = 16;
pub const KIND_RELAY_LIST_METADATA: u64 = 10_002;
pub const KIND_EMOJI_LIST: u64 = 10_030;
pub const KIND_ZAP_REQUEST: u64 = 9_734;
pub const KIND_ZAP_RECEIPT: u64 = 9_735;
pub const KIND_RELAY_AUTH: u64 = 22_242;
pub const KIND_BLOSSOM_AUTH: u64 = 24_242;
pub const KIND_HTTP_AUTH: u64 = 27_235;
pub const KIND_EMOJI_SET: u64 = 30_030;

pub fn is_replaceable_kind(kind: u64) -> bool {
    kind == KIND_METADATA || kind == KIND_FOLLOW_LIST || (10_000..20_000).contains(&kind)
}

pub fn is_ephemeral_kind(kind: u64) -> bool {
    (20_000..30_000).contains(&kind)
}

pub fn is_addressable_kind(kind: u64) -> bool {
    (30_000..40_000).contains(&kind)
}
