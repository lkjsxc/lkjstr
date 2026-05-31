use lkjstr_protocol::normalize_relay_url;

use super::defaults::{create_relay, default_discovery_relay_set, default_user_relay_set};
use super::types::{RelayPatch, RelayPurpose, RelayRecord, RelaySet, RelaySetError};

#[must_use]
pub fn seed_relay_sets(existing: &[RelaySet], now: u64) -> Vec<RelaySet> {
    if existing.is_empty() {
        return vec![
            default_user_relay_set(now),
            default_discovery_relay_set(now),
        ];
    }
    reset_relay_live_state(existing)
}

#[must_use]
pub fn reset_relay_live_state(sets: &[RelaySet]) -> Vec<RelaySet> {
    sets.iter()
        .cloned()
        .map(|mut set| {
            set.relays.iter_mut().for_each(|relay| {
                relay.state = super::types::RelayConnectionState::Idle;
            });
            set
        })
        .collect()
}

pub fn add_relay(
    sets: &[RelaySet],
    set_id: &str,
    input: &str,
    now: u64,
) -> Result<Vec<RelaySet>, RelaySetError> {
    let url = normalize_relay_url(input).ok_or(RelaySetError::InvalidUrl)?;
    update_set(sets, set_id, now, |mut set| {
        if !set.relays.iter().any(|relay| relay.url == url) {
            set.relays.push(create_relay(&url, now));
        }
        Ok(set)
    })
}

pub fn patch_relay(
    sets: &[RelaySet],
    set_id: &str,
    url: &str,
    patch: RelayPatch,
    now: u64,
) -> Result<Vec<RelaySet>, RelaySetError> {
    update_set(sets, set_id, now, |mut set| {
        set.relays.iter_mut().for_each(|relay| {
            if relay.url == url {
                apply_patch(relay, &set.purpose, &patch, now);
            }
        });
        Ok(set)
    })
}

pub fn remove_relay(
    sets: &[RelaySet],
    set_id: &str,
    url: &str,
    now: u64,
) -> Result<Vec<RelaySet>, RelaySetError> {
    update_set(sets, set_id, now, |mut set| {
        set.relays.retain(|relay| relay.url != url);
        Ok(set)
    })
}

#[must_use]
pub fn restore_default_relay_set(
    sets: &[RelaySet],
    purpose: RelayPurpose,
    now: u64,
) -> Vec<RelaySet> {
    let replacement = match purpose {
        RelayPurpose::User => default_user_relay_set(now),
        RelayPurpose::Discovery => default_discovery_relay_set(now),
    };
    replace_or_append(sets, replacement)
}

pub fn ensure_user_set(sets: &[RelaySet], set_id: &str) -> Result<(), RelaySetError> {
    match sets.iter().find(|set| set.id == set_id) {
        Some(set) if set.purpose == RelayPurpose::User => Ok(()),
        Some(_) => Err(RelaySetError::NotUserSet),
        None => Err(RelaySetError::SetNotFound),
    }
}

#[must_use]
pub fn sorted_relay_sets(mut sets: Vec<RelaySet>) -> Vec<RelaySet> {
    sets.sort_by(|left, right| {
        purpose_rank(left.purpose)
            .cmp(&purpose_rank(right.purpose))
            .then_with(|| right.updated_at.cmp(&left.updated_at))
            .then_with(|| left.id.cmp(&right.id))
    });
    sets
}

fn update_set(
    sets: &[RelaySet],
    set_id: &str,
    now: u64,
    update: impl FnOnce(RelaySet) -> Result<RelaySet, RelaySetError>,
) -> Result<Vec<RelaySet>, RelaySetError> {
    let Some(position) = sets.iter().position(|set| set.id == set_id) else {
        return Err(RelaySetError::SetNotFound);
    };
    let mut next = sets.to_vec();
    let mut updated = update(next[position].clone())?;
    updated.updated_at = now;
    next[position] = updated;
    Ok(next)
}

fn apply_patch(relay: &mut RelayRecord, purpose: &RelayPurpose, patch: &RelayPatch, now: u64) {
    match patch {
        RelayPatch::Label(label) => relay.label = label.trim().to_owned(),
        RelayPatch::Enabled(enabled) => relay.enabled = *enabled,
        RelayPatch::Read(read) if *purpose == RelayPurpose::User => relay.read = *read,
        RelayPatch::Write(write) if *purpose == RelayPurpose::User => relay.write = *write,
        RelayPatch::Read(_) | RelayPatch::Write(_) => {}
    }
    relay.updated_at = now;
}

fn replace_or_append(sets: &[RelaySet], replacement: RelaySet) -> Vec<RelaySet> {
    let mut replaced = false;
    let mut next = sets
        .iter()
        .cloned()
        .map(|set| {
            if set.id == replacement.id {
                replaced = true;
                replacement.clone()
            } else {
                set
            }
        })
        .collect::<Vec<_>>();
    if !replaced {
        next.push(replacement);
    }
    next
}

fn purpose_rank(purpose: RelayPurpose) -> u8 {
    match purpose {
        RelayPurpose::User => 0,
        RelayPurpose::Discovery => 1,
    }
}
