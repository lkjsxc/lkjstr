use serde_json::Value;

use lkjstr_protocol::{
    KIND_FOLLOW_LIST, KIND_METADATA, NostrEvent, ProfilePointer, encode_nprofile, encode_npub,
    following_count, is_pubkey,
};

use crate::{FollowCountEvidence, FollowCountState, follow_count_label, reduce_follow_count};

use super::ProfileHeaderView;

pub struct ProfileHeaderInput<'a> {
    pub pubkey: &'a str,
    pub metadata_event: Option<&'a NostrEvent>,
    pub follow_list_event: Option<&'a NostrEvent>,
}

#[must_use]
pub fn profile_header_view(input: ProfileHeaderInput<'_>) -> ProfileHeaderView {
    let metadata = profile_metadata(input.pubkey, input.metadata_event);
    let follow_state = follow_count_state(input.pubkey, input.follow_list_event);
    ProfileHeaderView {
        pubkey: input.pubkey.to_owned(),
        display_name: display_name(input.pubkey, metadata.as_ref()),
        subtitle: subtitle(input.pubkey, metadata.as_ref()),
        npub: profile_npub(input.pubkey),
        nprofile: None,
        follow_list_json: follow_list_json(input.pubkey, input.follow_list_event),
        relay_sets_json: "[]".to_owned(),
        avatar_url: string_field(metadata.as_ref(), "picture"),
        banner_url: string_field(metadata.as_ref(), "banner"),
        about: string_field(metadata.as_ref(), "about"),
        website: normalized_website(string_field(metadata.as_ref(), "website")),
        following_label: following_label(follow_state),
        following_known: matches!(
            follow_state,
            FollowCountState::Known { .. } | FollowCountState::KnownEmpty
        ),
    }
}

#[must_use]
pub fn profile_header_with_relays(
    header: ProfileHeaderView,
    relays: &[String],
) -> ProfileHeaderView {
    profile_header_with_copy_context(header, relays, "[]")
}

#[must_use]
pub fn profile_header_with_copy_context(
    mut header: ProfileHeaderView,
    relays: &[String],
    relay_sets_json: &str,
) -> ProfileHeaderView {
    if header.nprofile.is_none() {
        header.nprofile = nprofile(&header.pubkey, relays);
    }
    header.relay_sets_json = relay_sets_json.to_owned();
    header
}

#[must_use]
pub fn profile_header_or_default(
    header: Option<ProfileHeaderView>,
    pubkey: Option<&str>,
) -> Option<ProfileHeaderView> {
    header.or_else(|| {
        pubkey.map(|pubkey| {
            profile_header_view(ProfileHeaderInput {
                pubkey,
                metadata_event: None,
                follow_list_event: None,
            })
        })
    })
}

fn profile_metadata(pubkey: &str, event: Option<&NostrEvent>) -> Option<Value> {
    let event = event?;
    if event.kind != KIND_METADATA || event.pubkey != pubkey {
        return None;
    }
    serde_json::from_str::<Value>(&event.content).ok()
}

fn follow_count_state(pubkey: &str, event: Option<&NostrEvent>) -> FollowCountState {
    let state = FollowCountState::LoadingCache;
    let Some(event) = event else {
        return reduce_follow_count(state, FollowCountEvidence::CacheMiss);
    };
    if event.kind != KIND_FOLLOW_LIST || event.pubkey != pubkey {
        return reduce_follow_count(state, FollowCountEvidence::Unavailable);
    }
    reduce_follow_count(
        state,
        FollowCountEvidence::Known {
            count: following_count(event),
        },
    )
}

fn follow_list_json(pubkey: &str, event: Option<&NostrEvent>) -> String {
    let Some(event) = event else {
        return "null".to_owned();
    };
    if event.kind != KIND_FOLLOW_LIST || event.pubkey != pubkey {
        return "null".to_owned();
    }
    match serde_json::to_string_pretty(event) {
        Ok(value) => value,
        Err(_) => "null".to_owned(),
    }
}

fn display_name(pubkey: &str, metadata: Option<&Value>) -> String {
    string_field(metadata, "display_name")
        .or_else(|| string_field(metadata, "name"))
        .or_else(|| string_field(metadata, "nip05"))
        .unwrap_or_else(|| short_npub(pubkey))
}

fn subtitle(pubkey: &str, metadata: Option<&Value>) -> String {
    string_field(metadata, "nip05").unwrap_or_else(|| short_npub(pubkey))
}

fn following_label(state: FollowCountState) -> String {
    match state {
        FollowCountState::Known { count } => format!("{count} following"),
        _ => follow_count_label(state).to_owned(),
    }
}

#[must_use]
pub fn profile_npub(pubkey: &str) -> String {
    encode_npub(pubkey).unwrap_or_else(|_| pubkey.to_owned())
}

fn nprofile(pubkey: &str, relays: &[String]) -> Option<String> {
    encode_nprofile(&ProfilePointer {
        pubkey: pubkey.to_owned(),
        relays: (!relays.is_empty()).then(|| relays.to_vec()),
    })
    .ok()
}

fn short_npub(pubkey: &str) -> String {
    let value = profile_npub(pubkey);
    if !is_pubkey(pubkey) || value.len() < 16 {
        return pubkey.to_owned();
    }
    format!(
        "{}:{}",
        &value[..10],
        &value[value.len().saturating_sub(6)..]
    )
}

fn string_field(metadata: Option<&Value>, field: &str) -> Option<String> {
    metadata?
        .get(field)?
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn normalized_website(value: Option<String>) -> Option<String> {
    let text = value?.trim().to_owned();
    if text.starts_with("http://") || text.starts_with("https://") {
        return Some(text);
    }
    if text.contains(':') || !text.contains('.') {
        return None;
    }
    Some(format!("https://{text}"))
}
