#[path = "groups_types.rs"]
mod types;

use serde_json::Value;

use crate::{
    NostrEvent, NostrFilter, is_event_id, is_pubkey,
    kinds::{
        KIND_GROUP_ADMINS, KIND_GROUP_CLOSE_REPORT, KIND_GROUP_CREATE_GROUP,
        KIND_GROUP_CREATE_INVITE, KIND_GROUP_DELETE_EVENT, KIND_GROUP_DELETE_GROUP,
        KIND_GROUP_EDIT_METADATA, KIND_GROUP_JOIN_REQUEST, KIND_GROUP_LEAVE_REQUEST,
        KIND_GROUP_LIVEKIT_PARTICIPANTS, KIND_GROUP_MEMBERS, KIND_GROUP_METADATA,
        KIND_GROUP_PUT_USER, KIND_GROUP_REMOVE_USER, KIND_GROUP_ROLES, KIND_USER_GROUPS,
    },
};

pub use types::{
    GroupAdmin, GroupMember, GroupMetadata, GroupParseError, GroupPreviousRef, GroupReference,
    GroupRole,
};

pub fn group_id_from_h_tag(event: &NostrEvent) -> Option<String> {
    tag_value(event, "h")
}

pub fn group_state_id_from_d_tag(event: &NostrEvent) -> Option<String> {
    tag_value(event, "d")
}

pub fn group_previous_refs(event: &NostrEvent) -> Vec<GroupPreviousRef> {
    event
        .tags
        .iter()
        .filter(|tag| tag.first().is_some_and(|name| name == "previous"))
        .filter_map(|tag| {
            let event_id = tag.get(1)?.to_owned();
            is_event_id(&event_id).then(|| GroupPreviousRef {
                event_id,
                relay: tag.get(2).filter(|value| !value.is_empty()).cloned(),
            })
        })
        .collect()
}

pub fn group_metadata_from_event(event: &NostrEvent) -> Result<GroupMetadata, GroupParseError> {
    ensure_kind(event, KIND_GROUP_METADATA)?;
    let group_id = group_state_id_from_d_tag(event).ok_or(GroupParseError::MissingGroupId)?;
    let content = content_object(event)?;
    Ok(GroupMetadata {
        group_id,
        name: text(&content, "name"),
        about: text(&content, "about"),
        picture: text(&content, "picture"),
        public: content.get("public").and_then(Value::as_bool),
        open: content.get("open").and_then(Value::as_bool),
    })
}

pub fn group_admins_from_event(event: &NostrEvent) -> Result<Vec<GroupAdmin>, GroupParseError> {
    ensure_state(event, KIND_GROUP_ADMINS)?;
    Ok(event
        .tags
        .iter()
        .filter(|tag| tag.first().is_some_and(|name| name == "p"))
        .filter_map(|tag| {
            let pubkey = tag.get(1)?.to_owned();
            is_pubkey(&pubkey).then(|| GroupAdmin {
                pubkey,
                roles: tag
                    .iter()
                    .skip(2)
                    .filter(|item| !item.is_empty())
                    .cloned()
                    .collect(),
            })
        })
        .collect())
}

pub fn group_members_from_event(event: &NostrEvent) -> Result<Vec<GroupMember>, GroupParseError> {
    ensure_state(event, KIND_GROUP_MEMBERS)?;
    Ok(event.tags.iter().filter_map(member_from_tag).collect())
}

pub fn group_roles_from_event(event: &NostrEvent) -> Result<Vec<GroupRole>, GroupParseError> {
    ensure_state(event, KIND_GROUP_ROLES)?;
    Ok(event
        .tags
        .iter()
        .filter(|tag| tag.first().is_some_and(|name| name == "role"))
        .filter_map(|tag| {
            let role = tag.get(1).filter(|item| !item.is_empty())?.to_owned();
            Some(GroupRole {
                role,
                description: tag.get(2).filter(|item| !item.is_empty()).cloned(),
            })
        })
        .collect())
}

pub fn group_user_list_from_event(
    event: &NostrEvent,
) -> Result<Vec<GroupReference>, GroupParseError> {
    ensure_kind(event, KIND_USER_GROUPS)?;
    Ok(event.tags.iter().filter_map(group_ref_from_tag).collect())
}

pub fn is_group_state_kind(kind: u64) -> bool {
    matches!(
        kind,
        KIND_GROUP_METADATA
            | KIND_GROUP_ADMINS
            | KIND_GROUP_MEMBERS
            | KIND_GROUP_ROLES
            | KIND_GROUP_LIVEKIT_PARTICIPANTS
    )
}

pub fn is_group_moderation_kind(kind: u64) -> bool {
    matches!(
        kind,
        KIND_GROUP_PUT_USER
            | KIND_GROUP_REMOVE_USER
            | KIND_GROUP_EDIT_METADATA
            | KIND_GROUP_DELETE_EVENT
            | KIND_GROUP_CREATE_GROUP
            | KIND_GROUP_DELETE_GROUP
            | KIND_GROUP_CREATE_INVITE
            | KIND_GROUP_JOIN_REQUEST
            | KIND_GROUP_LEAVE_REQUEST
            | KIND_GROUP_CLOSE_REPORT
    )
}

pub fn group_user_event_filter(group_id: &str, kinds: Vec<u64>, limit: u64) -> NostrFilter {
    let mut filter = NostrFilter {
        kinds: Some(kinds),
        limit: Some(limit),
        ..NostrFilter::default()
    };
    filter
        .tags
        .insert("h".to_owned(), vec![group_id.to_owned()]);
    filter
}

fn ensure_kind(event: &NostrEvent, kind: u64) -> Result<(), GroupParseError> {
    (event.kind == kind)
        .then_some(())
        .ok_or(GroupParseError::WrongKind)
}

fn ensure_state(event: &NostrEvent, kind: u64) -> Result<(), GroupParseError> {
    ensure_kind(event, kind)?;
    group_state_id_from_d_tag(event)
        .map(|_| ())
        .ok_or(GroupParseError::MissingGroupId)
}

fn tag_value(event: &NostrEvent, name: &str) -> Option<String> {
    event
        .tags
        .iter()
        .find(|tag| tag.first().is_some_and(|item| item == name))
        .and_then(|tag| tag.get(1))
        .filter(|value| !value.is_empty())
        .cloned()
}

fn content_object(event: &NostrEvent) -> Result<Value, GroupParseError> {
    serde_json::from_str::<Value>(&event.content).map_err(|_| GroupParseError::BadContent)
}

fn text(content: &Value, key: &str) -> Option<String> {
    content
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(ToOwned::to_owned)
}

fn member_from_tag(tag: &Vec<String>) -> Option<GroupMember> {
    let pubkey = tag.get(1)?.to_owned();
    is_pubkey(&pubkey).then(|| GroupMember {
        pubkey,
        label: tag.get(2).filter(|item| !item.is_empty()).cloned(),
    })
}

fn group_ref_from_tag(tag: &Vec<String>) -> Option<GroupReference> {
    if !tag.first().is_some_and(|name| name == "group") {
        return None;
    }
    let group_id = tag.get(2).filter(|item| !item.is_empty())?.to_owned();
    Some(GroupReference {
        relay: tag.get(1).filter(|item| !item.is_empty()).cloned(),
        group_id,
    })
}
