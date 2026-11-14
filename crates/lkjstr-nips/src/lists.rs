//! NIP-02 contacts and lossless public/opaque-private NIP-51 list handling.
use crate::{
    Error, Result,
    event::{Tag, UnsignedEvent, unique},
    unhex,
};

/// NIP-02 follow entry; relay and petname are untrusted metadata.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Contact {
    /// Lowercase hex key.
    pub pubkey: String,
    /// Optional relay hint.
    pub relay: Option<String>,
    /// Optional local petname.
    pub petname: Option<String>,
}
/// Parse kind-3 contacts, ignoring malformed entries and duplicate keys.
pub fn contacts(event: &UnsignedEvent) -> Result<Vec<Contact>> {
    if event.kind != 3 {
        return Err(Error::Invalid);
    }
    let mut result: Vec<Contact> = vec![];
    for tag in &event.tags {
        if tag.first().is_none_or(|k| k != "p") {
            continue;
        }
        let Some(key) = tag.get(1).filter(|k| unhex::<32>(k).is_ok()) else {
            continue;
        };
        if result.iter().any(|c| &c.pubkey == key) {
            continue;
        }
        result.push(Contact {
            pubkey: key.clone(),
            relay: tag.get(2).filter(|s| !s.is_empty()).cloned(),
            petname: tag.get(3).filter(|s| !s.is_empty()).cloned(),
        });
    }
    Ok(result)
}
/// Build contacts without dropping the positional empty relay field.
pub fn contact_tags(contacts: &[Contact]) -> Result<Vec<Tag>> {
    contacts
        .iter()
        .map(|c| {
            unhex::<32>(&c.pubkey)?;
            let mut tag = vec!["p".into(), c.pubkey.clone()];
            if c.relay.is_some() || c.petname.is_some() {
                tag.push(c.relay.clone().unwrap_or_default());
            }
            if let Some(name) = &c.petname {
                tag.push(name.clone());
            }
            Ok(tag)
        })
        .collect()
}
/// NIP-51 list content. Unknown public tags are retained for extensibility.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct List {
    /// List event kind.
    pub kind: u16,
    /// Set identifier for addressable list kinds.
    pub identifier: Option<String>,
    /// Public entries and metadata in original order.
    pub tags: Vec<Tag>,
    /// Opaque private content; never interpreted as empty entries.
    pub encrypted_content: String,
}
/// Recognized NIP-51 simple lists and sets, including relay/inbox lists.
pub fn is_list_kind(kind: u16) -> bool {
    matches!(kind, 3 | 10000..=10009 | 10012 | 10013 | 10015 | 10017 | 10018 | 10020 | 10021
        | 10030 | 10050 | 10054 | 10063 | 10064 | 10101 | 10102 | 10992
        | 30000..=30008 | 30015 | 30030 | 30063 | 30267 | 31924 | 39089 | 39092)
}
impl List {
    /// Parse a list without decrypting or losing private content.
    pub fn parse(event: &UnsignedEvent) -> Result<Self> {
        if !is_list_kind(event.kind) {
            return Err(Error::Invalid);
        }
        let identifier = unique(&event.tags, "d")?.map(str::to_owned);
        if event.kind >= 30000 && identifier.is_none() {
            return Err(Error::Invalid);
        }
        Ok(Self {
            kind: event.kind,
            identifier,
            tags: event.tags.clone(),
            encrypted_content: event.content.clone(),
        })
    }
    /// Build the original public/private list payload with a new author/time.
    pub fn event(&self, pubkey: String, created_at: u64) -> Result<UnsignedEvent> {
        let event = UnsignedEvent::new(
            pubkey,
            created_at,
            self.kind,
            self.tags.clone(),
            self.encrypted_content.clone(),
        );
        let parsed = Self::parse(&event)?;
        if parsed.identifier != self.identifier {
            return Err(Error::Invalid);
        }
        event.validate()?;
        Ok(event)
    }
    /// Parse already-decrypted private entries supplied by a host decryptor.
    pub fn private_entries(plaintext: &str, max_bytes: usize) -> Result<Vec<Tag>> {
        if plaintext.len() > max_bytes {
            return Err(Error::Size);
        }
        let tags: Vec<Tag> = serde_json::from_str(plaintext)?;
        if tags.iter().any(Vec::is_empty) {
            return Err(Error::Invalid);
        }
        Ok(tags)
    }
}
