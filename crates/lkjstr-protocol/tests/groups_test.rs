use lkjstr_protocol::{
    GroupParseError, KIND_GROUP_ADMINS, KIND_GROUP_MEMBERS, KIND_GROUP_METADATA, KIND_GROUP_ROLES,
    KIND_TEXT_NOTE, KIND_USER_GROUPS, group_admins_from_event, group_id_from_h_tag,
    group_members_from_event, group_metadata_from_event, group_previous_refs,
    group_roles_from_event, group_state_id_from_d_tag, group_user_event_filter,
    group_user_list_from_event, is_group_moderation_kind, is_group_state_kind,
};

#[test]
fn parses_group_ids_and_previous_refs() {
    let event = event(
        KIND_TEXT_NOTE,
        vec![
            tag(&["h", "group-a"]),
            tag(&["previous", &"1".repeat(64), "wss://relay.example"]),
            tag(&["previous", "bad"]),
        ],
        "",
    );

    assert_eq!(group_id_from_h_tag(&event), Some("group-a".to_owned()));
    assert_eq!(group_previous_refs(&event).len(), 1);
}

#[test]
fn parses_group_state_events() {
    let metadata = event(
        KIND_GROUP_METADATA,
        vec![tag(&["d", "group-a"])],
        r#"{"name":"Group A","about":"About","public":true,"open":false}"#,
    );
    let parsed = group_metadata_from_event(&metadata).expect("metadata parses");

    assert_eq!(
        group_state_id_from_d_tag(&metadata),
        Some("group-a".to_owned())
    );
    assert_eq!(parsed.name.as_deref(), Some("Group A"));
    assert_eq!(parsed.public, Some(true));
}

#[test]
fn parses_admin_member_role_and_user_group_lists() {
    let pubkey = "2".repeat(64);
    let admins = event(
        KIND_GROUP_ADMINS,
        vec![tag(&["d", "g"]), tag(&["p", &pubkey, "moderator"])],
        "",
    );
    let members = event(
        KIND_GROUP_MEMBERS,
        vec![tag(&["d", "g"]), tag(&["p", &pubkey, "Alice"])],
        "",
    );
    let roles = event(
        KIND_GROUP_ROLES,
        vec![
            tag(&["d", "g"]),
            tag(&["role", "moderator", "Can moderate"]),
        ],
        "",
    );
    let groups = event(
        KIND_USER_GROUPS,
        vec![tag(&["group", "wss://relay.example", "g"])],
        "",
    );

    assert_eq!(
        group_admins_from_event(&admins).expect("admins")[0].roles,
        vec!["moderator"]
    );
    assert_eq!(
        group_members_from_event(&members).expect("members")[0]
            .label
            .as_deref(),
        Some("Alice")
    );
    assert_eq!(
        group_roles_from_event(&roles).expect("roles")[0].role,
        "moderator"
    );
    assert_eq!(
        group_user_list_from_event(&groups).expect("groups")[0].group_id,
        "g"
    );
}

#[test]
fn rejects_group_state_without_group_id() {
    let metadata = event(KIND_GROUP_METADATA, Vec::new(), "{}");

    assert_eq!(
        group_metadata_from_event(&metadata),
        Err(GroupParseError::MissingGroupId)
    );
}

#[test]
fn classifies_group_kinds_and_builds_h_filter() {
    let filter = group_user_event_filter("group-a", vec![KIND_TEXT_NOTE], 50);

    assert!(is_group_state_kind(KIND_GROUP_METADATA));
    assert!(is_group_moderation_kind(9_000));
    assert_eq!(filter.tags.get("h"), Some(&vec!["group-a".to_owned()]));
    assert_eq!(filter.limit, Some(50));
}

fn event(kind: u64, tags: Vec<Vec<String>>, content: &str) -> lkjstr_protocol::NostrEvent {
    lkjstr_protocol::NostrEvent {
        id: "1".repeat(64),
        pubkey: "2".repeat(64),
        created_at: 1,
        kind,
        tags,
        content: content.to_owned(),
        sig: "3".repeat(128),
    }
}

fn tag(parts: &[&str]) -> Vec<String> {
    parts.iter().map(|part| (*part).to_owned()).collect()
}
