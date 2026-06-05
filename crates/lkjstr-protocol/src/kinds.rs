pub const KIND_METADATA: u64 = 0;
pub const KIND_TEXT_NOTE: u64 = 1;
pub const KIND_RECOMMEND_RELAY: u64 = 2;
pub const KIND_FOLLOW_LIST: u64 = 3;
pub const KIND_DELETION: u64 = 5;
pub const KIND_REPOST: u64 = 6;
pub const KIND_REACTION: u64 = 7;
pub const KIND_GENERIC_REPOST: u64 = 16;
pub const KIND_CHANNEL_CREATE: u64 = 40;
pub const KIND_CHANNEL_METADATA: u64 = 41;
pub const KIND_CHANNEL_MESSAGE: u64 = 42;
pub const KIND_CHANNEL_HIDE_MESSAGE: u64 = 43;
pub const KIND_CHANNEL_MUTE_USER: u64 = 44;
pub const KIND_GROUP_PUT_USER: u64 = 9_000;
pub const KIND_GROUP_REMOVE_USER: u64 = 9_001;
pub const KIND_GROUP_EDIT_METADATA: u64 = 9_002;
pub const KIND_GROUP_DELETE_EVENT: u64 = 9_005;
pub const KIND_GROUP_CREATE_GROUP: u64 = 9_007;
pub const KIND_GROUP_DELETE_GROUP: u64 = 9_008;
pub const KIND_GROUP_CREATE_INVITE: u64 = 9_009;
pub const KIND_GROUP_JOIN_REQUEST: u64 = 9_021;
pub const KIND_GROUP_LEAVE_REQUEST: u64 = 9_022;
pub const KIND_GROUP_CLOSE_REPORT: u64 = 9_030;
pub const KIND_RELAY_LIST_METADATA: u64 = 10_002;
pub const KIND_USER_GROUPS: u64 = 10_009;
pub const KIND_EMOJI_LIST: u64 = 10_030;
pub const KIND_ZAP_REQUEST: u64 = 9_734;
pub const KIND_ZAP_RECEIPT: u64 = 9_735;
pub const KIND_RELAY_AUTH: u64 = 22_242;
pub const KIND_BLOSSOM_AUTH: u64 = 24_242;
pub const KIND_HTTP_AUTH: u64 = 27_235;
pub const KIND_EMOJI_SET: u64 = 30_030;
pub const KIND_HANDLER_RECOMMENDATION: u64 = 31_989;
pub const KIND_HANDLER_INFORMATION: u64 = 31_990;
pub const KIND_GROUP_METADATA: u64 = 39_000;
pub const KIND_GROUP_ADMINS: u64 = 39_001;
pub const KIND_GROUP_MEMBERS: u64 = 39_002;
pub const KIND_GROUP_ROLES: u64 = 39_003;
pub const KIND_GROUP_LIVEKIT_PARTICIPANTS: u64 = 39_004;

pub fn is_replaceable_kind(kind: u64) -> bool {
    kind == KIND_METADATA || kind == KIND_FOLLOW_LIST || (10_000..20_000).contains(&kind)
}

pub fn is_ephemeral_kind(kind: u64) -> bool {
    (20_000..30_000).contains(&kind)
}

pub fn is_addressable_kind(kind: u64) -> bool {
    (30_000..40_000).contains(&kind)
}
