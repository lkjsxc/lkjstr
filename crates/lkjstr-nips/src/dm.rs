//! NIP-17 kind-14 text DMs and recipient inbox routing. No network effects.
use crate::{
    Error, Result,
    event::{Rumor, UnsignedEvent, unique, values},
    relay::relay_url,
    unhex,
};
use crate::{gift, keys::SecretKey};
use std::collections::BTreeSet;

/// Construct a kind-14 rumor; recipients define the room with the author.
pub fn message(
    author: String,
    recipients: &[String],
    content: &str,
    now: u64,
    reply_to: Option<&str>,
    subject: Option<&str>,
) -> Result<Rumor> {
    unhex::<32>(&author)?;
    if recipients.is_empty() {
        return Err(Error::Invalid);
    }
    let mut tags = Vec::new();
    let mut seen = BTreeSet::new();
    for recipient in recipients {
        unhex::<32>(recipient)?;
        if seen.insert(recipient) {
            tags.push(vec!["p".into(), recipient.clone()]);
        }
    }
    if let Some(id) = reply_to {
        unhex::<32>(id)?;
        tags.push(vec!["e".into(), id.into()]);
    }
    if let Some(subject) = subject {
        tags.push(vec!["subject".into(), subject.into()]);
    }
    UnsignedEvent::new(author, now, 14, tags, content).rumor()
}
/// Participants, including the author and sender's archive copy. Signature/ID
/// authentication must come from `gift::unwrap` before displaying a rumor.
pub fn participants(rumor: &Rumor) -> Result<BTreeSet<String>> {
    rumor.verify_id()?;
    if rumor.data.kind != 14 {
        return Err(Error::Invalid);
    }
    unhex::<32>(&rumor.data.pubkey)?;
    let mut peers = BTreeSet::from([rumor.data.pubkey.clone()]);
    let mut count = 0;
    for p in values(&rumor.data.tags, "p") {
        unhex::<32>(p)?;
        peers.insert(p.into());
        count += 1;
    }
    if count == 0 {
        return Err(Error::Invalid);
    }
    if let Some(id) = unique(&rumor.data.tags, "e")? {
        unhex::<32>(id)?;
    }
    unique(&rumor.data.tags, "subject")?;
    Ok(peers)
}
/// Wrap a kind-14 rumor only for an actual participant. Hosts must supply a
/// fresh one-use wrapping key for each participant, including the sender.
pub fn wrap(
    rumor: &Rumor,
    sender: &SecretKey,
    recipient: &[u8; 32],
    params: &gift::WrapParameters<'_>,
) -> Result<crate::event::Event> {
    if !participants(rumor)?.contains(&crate::hex(recipient)) {
        return Err(Error::Identity);
    }
    gift::wrap(rumor, sender, recipient, params)
}
/// Authenticate and unwrap a kind-14 message, rejecting delivery into a room
/// whose participant set does not include the receiving account.
pub fn unwrap(event: &crate::event::Event, recipient: &SecretKey) -> Result<Rumor> {
    let rumor = gift::unwrap(event, recipient)?;
    if !participants(&rumor)?.contains(&recipient.public_key()) {
        return Err(Error::Identity);
    }
    Ok(rumor)
}
/// Obtain routing only from the recipient's kind-10050 event. Absence, wrong
/// author, invalid signature, or an empty relay list is an explicit failure.
pub fn inbox_relays(event: Option<&crate::event::Event>, recipient: &str) -> Result<Vec<String>> {
    let event = event.ok_or(Error::Invalid)?;
    event.verify()?;
    if event.data.kind != 10050 || event.data.pubkey != recipient {
        return Err(Error::Identity);
    }
    let relays: BTreeSet<_> = values(&event.data.tags, "relay")
        .filter_map(|r| relay_url(r).ok())
        .collect();
    if relays.is_empty() {
        return Err(Error::Invalid);
    }
    Ok(relays.into_iter().collect())
}
