use lkjstr_protocol::{
    KIND_FOLLOW_LIST, KIND_GROUP_METADATA, KIND_HANDLER_INFORMATION, KIND_HANDLER_RECOMMENDATION,
    KIND_METADATA, KIND_USER_GROUPS, is_addressable_kind, is_ephemeral_kind, is_replaceable_kind,
};

#[test]
fn classifies_kind_ranges() {
    assert!(is_replaceable_kind(KIND_METADATA));
    assert!(is_replaceable_kind(KIND_FOLLOW_LIST));
    assert!(is_replaceable_kind(10_002));
    assert!(!is_replaceable_kind(20_000));
    assert!(is_ephemeral_kind(20_000));
    assert!(!is_ephemeral_kind(30_000));
    assert!(is_addressable_kind(30_000));
    assert!(!is_addressable_kind(40_000));
    assert!(is_replaceable_kind(KIND_USER_GROUPS));
    assert!(is_addressable_kind(KIND_HANDLER_RECOMMENDATION));
    assert!(is_addressable_kind(KIND_HANDLER_INFORMATION));
    assert!(is_addressable_kind(KIND_GROUP_METADATA));
}
