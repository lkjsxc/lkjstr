//! Public attribution follows the signed request; DIP-03 private data stays opaque.
use super::{Failure, Result};
use lkjstr_nips::event::Event;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "k", rename_all = "lowercase")]
pub enum Sender {
    Public { pubkey: String },
    Anonymous,
    Private,
}
pub(super) fn payer(request: &Event) -> Result<Sender> {
    let mut tags = request
        .data
        .tags
        .iter()
        .filter(|t| t.first().is_some_and(|s| s == "anon"));
    let Some(tag) = tags.next() else {
        return Ok(Sender::Public {
            pubkey: request.data.pubkey.clone(),
        });
    };
    if tags.next().is_some() || tag.len() > 2 {
        return Err(Failure::Rejected);
    }
    // The encrypted payload's outer key is ephemeral; it cannot identify the payer.
    Ok(if tag.get(1).is_some_and(|s| !s.is_empty()) {
        Sender::Private
    } else {
        Sender::Anonymous
    })
}
