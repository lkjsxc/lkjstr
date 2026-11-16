//! Private draft wire values. Dropping an owned state erases its text buffers.
use crate::engine::dm::{Draft, MAX_PARTICIPANTS};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use zeroize::Zeroize;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct State {
    pub draft: Draft,
    #[serde(default)]
    pub failed: Vec<Failed>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Failed {
    pub key: String,
    pub draft: Draft,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<Failure>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dm_delivery: Option<Delivery>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
}
/// Only the stable code is retained; external error messages are deliberately ignored.
#[derive(Clone, Serialize, Deserialize)]
pub struct Failure {
    pub code: String,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Delivery {
    pub accepted: u32,
    pub total: u32,
}
impl Default for State {
    fn default() -> Self {
        Self {
            draft: Draft {
                recipients: vec![],
                text: String::new(),
                reply_to: None,
                subject: None,
                emoji: None,
            },
            failed: vec![],
        }
    }
}
fn erase(draft: &mut Draft) {
    draft.text.zeroize();
    draft.recipients.zeroize();
    draft.reply_to.zeroize();
    draft.subject.zeroize();
    if let Some(emoji) = &mut draft.emoji {
        for item in emoji {
            item.code.zeroize();
            item.url.zeroize();
        }
    }
}
impl Drop for State {
    fn drop(&mut self) {
        erase(&mut self.draft);
    }
}
impl Drop for Failed {
    fn drop(&mut self) {
        erase(&mut self.draft);
        self.key.zeroize();
        self.id.zeroize();
    }
}
impl std::fmt::Debug for State {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("DmDraftState [redacted]")
    }
}
impl std::fmt::Debug for Failed {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("DmFailedDraft [redacted]")
    }
}
pub(super) fn validate(state: &State) -> Result<(), &'static str> {
    if state.failed.len() > super::MAX_FAILED {
        return Err("too-large");
    }
    validate_draft(&state.draft)?;
    let mut keys = BTreeSet::new();
    for failed in &state.failed {
        super::tab_key(&failed.key)?;
        if !keys.insert(&failed.key)
            || failed
                .id
                .as_deref()
                .is_some_and(|id| !lkjstr_protocol::is_event_id(id))
            || failed
                .dm_delivery
                .as_ref()
                .is_some_and(|d| d.accepted > d.total || d.total > MAX_PARTICIPANTS as u32)
            || failed.error.as_ref().is_some_and(|e| !known_error(&e.code))
        {
            return Err("rejected");
        }
        validate_draft(&failed.draft)?;
    }
    let raw = crate::engine::accounts::secret::SecretText::new(
        serde_json::to_string(state).map_err(|_| "internal")?,
    );
    if raw.len() > super::MAX_STATE {
        return Err("too-large");
    }
    Ok(())
}
fn validate_draft(draft: &Draft) -> Result<(), &'static str> {
    // An unsent over-limit message must remain recoverable; sending has its own 16 KiB limit.
    if draft.text.len() > super::MAX_STATE
        || draft.recipients.len() >= MAX_PARTICIPANTS
        || draft.subject.as_ref().is_some_and(|s| s.len() > 256)
        || draft.emoji.as_ref().is_some_and(|e| e.len() > 64)
    {
        return Err("too-large");
    }
    if draft
        .recipients
        .iter()
        .any(|p| !lkjstr_protocol::is_pubkey(p))
        || draft
            .reply_to
            .as_deref()
            .is_some_and(|id| !lkjstr_protocol::is_event_id(id))
    {
        return Err("rejected");
    }
    if let Some(emoji) = &draft.emoji {
        if emoji
            .iter()
            .map(|e| e.code.len() + e.url.len())
            .sum::<usize>()
            > 16 * 1024
        {
            return Err("too-large");
        }
        if emoji.iter().any(|e| {
            e.code.len() > 64
                || e.url.len() > 2048
                || !lkjstr_protocol::valid_custom_emoji_shortcode(&e.code)
                || !lkjstr_protocol::valid_custom_emoji_url(&e.url)
        }) {
            return Err("rejected");
        }
    }
    Ok(())
}
fn known_error(code: &str) -> bool {
    matches!(
        code,
        "signed-out"
            | "read-only"
            | "signer-refused"
            | "signer-timeout"
            | "signer-missing"
            | "no-relays"
            | "rejected"
            | "too-large"
            | "unsupported"
            | "offline"
            | "not-found"
            | "internal"
            | "upload-network"
            | "upload-timeout"
            | "upload-payment"
            | "upload-response"
            | "upload-discovery"
    )
}
