use crate::is_pubkey;

use super::types::{GroupMember, GroupReference};

pub fn member_from_tag(tag: &[String]) -> Option<GroupMember> {
    let pubkey = tag.get(1)?.to_owned();
    is_pubkey(&pubkey).then(|| GroupMember {
        pubkey,
        label: tag.get(2).filter(|item| !item.is_empty()).cloned(),
    })
}

pub fn group_ref_from_tag(tag: &[String]) -> Option<GroupReference> {
    if tag.first().is_none_or(|name| name != "group") {
        return None;
    }
    let group_id = tag.get(2).filter(|item| !item.is_empty())?.to_owned();
    Some(GroupReference {
        relay: tag.get(1).filter(|item| !item.is_empty()).cloned(),
        group_id,
    })
}
