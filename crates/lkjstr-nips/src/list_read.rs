//! Bounded read-only NIP-51 plaintext and NIP-44 / historical NIP-04 detection.
use crate::{Error, Result, event::Tag, nip44};
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::de::{DeserializeSeed, Deserializer, Error as _, SeqAccess, Visitor};
use std::{cell::Cell, fmt};

/// Maximum tags in one private section; excess is rejected, never truncated.
pub const MAX_TAGS: usize = 8192;
/// Maximum fields in one tag.
pub const MAX_FIELDS: usize = 32;
/// Maximum total fields in one private section.
pub const MAX_TOTAL_FIELDS: usize = 32768;
/// A validated cipher envelope selects exactly one read operation.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum Format {
    /// Current authenticated version-2 payload.
    Nip44,
    /// Historical AES-CBC payload; no encryption operation is exposed.
    Nip04,
}
impl Format {
    /// Existing browser crypto operation name.
    pub fn operation(self) -> &'static str {
        match self {
            Self::Nip44 => "nip44.decrypt",
            Self::Nip04 => "nip04.decrypt",
        }
    }
}
/// Select a format from its structure; no fallback follows a failed decrypt.
pub fn format(payload: &str) -> Result<Option<Format>> {
    if payload.is_empty() {
        return Ok(None);
    }
    if payload.len() > nip44::MAX_PAYLOAD {
        return Err(Error::Size);
    }
    if let Some((cipher, iv)) = payload.split_once("?iv=") {
        let iv = STANDARD.decode(iv).map_err(|_| Error::Invalid)?;
        let cipher = STANDARD.decode(cipher).map_err(|_| Error::Invalid)?;
        if iv.len() != 16 || cipher.is_empty() || cipher.len() % 16 != 0 {
            return Err(Error::Invalid);
        }
        return Ok(Some(Format::Nip04));
    }
    if payload.starts_with('#') {
        return Err(Error::Version);
    }
    let decoded = STANDARD.decode(payload).map_err(|_| Error::Invalid)?;
    if decoded.first().is_some_and(|v| *v != 2) {
        return Err(Error::Version);
    }
    if decoded.len() < 99 {
        return Err(Error::Invalid);
    }
    Ok(Some(Format::Nip44))
}
/// Parsed tags plus the actual retained allocation size.
pub struct Entries {
    /// Decrypted tags in their original order.
    pub tags: Vec<Tag>,
    /// Vec and string capacities used for the shared cache budget.
    pub allocated: usize,
}
struct Tags<'a> {
    fields: &'a Cell<usize>,
    oversized: &'a Cell<bool>,
}
struct TagSeed<'a>(&'a Tags<'a>);
impl<'de> DeserializeSeed<'de> for TagSeed<'_> {
    type Value = Tag;
    fn deserialize<D: Deserializer<'de>>(self, d: D) -> std::result::Result<Tag, D::Error> {
        d.deserialize_seq(self)
    }
}
impl<'de> Visitor<'de> for TagSeed<'_> {
    type Value = Tag;
    fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("a bounded nonempty tag")
    }
    fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> std::result::Result<Tag, A::Error> {
        let mut tag = Vec::new();
        loop {
            if tag.len() == MAX_FIELDS || self.0.fields.get() == MAX_TOTAL_FIELDS {
                if seq.next_element::<serde::de::IgnoredAny>()?.is_some() {
                    self.0.oversized.set(true);
                    return Err(A::Error::custom("too many fields"));
                }
                break;
            }
            let Some(field) = seq.next_element::<String>()? else {
                break;
            };
            self.0.fields.set(self.0.fields.get() + 1);
            tag.push(field);
        }
        if tag.is_empty() {
            return Err(A::Error::custom("empty tag"));
        }
        Ok(tag)
    }
}
impl<'de> Visitor<'de> for Tags<'_> {
    type Value = Vec<Tag>;
    fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("a bounded tag array")
    }
    fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> std::result::Result<Vec<Tag>, A::Error> {
        let mut tags = Vec::new();
        loop {
            if tags.len() == MAX_TAGS {
                if seq.next_element::<serde::de::IgnoredAny>()?.is_some() {
                    self.oversized.set(true);
                    return Err(A::Error::custom("too many tags"));
                }
                break;
            }
            let Some(tag) = seq.next_element_seed(TagSeed(&self))? else {
                break;
            };
            tags.push(tag);
        }
        Ok(tags)
    }
}
/// Parse private entries without allocating an unbounded number of tiny tags.
pub fn entries(text: &str) -> Result<Entries> {
    if text.len() > nip44::MAX_PLAINTEXT {
        return Err(Error::Size);
    }
    let oversized = Cell::new(false);
    let fields = Cell::new(0);
    let mut de = serde_json::Deserializer::from_str(text);
    let tags = de
        .deserialize_seq(Tags {
            fields: &fields,
            oversized: &oversized,
        })
        .map_err(|_| {
            if oversized.get() {
                Error::Size
            } else {
                Error::Invalid
            }
        })?;
    de.end().map_err(|_| Error::Invalid)?;
    let allocated = tags.capacity() * std::mem::size_of::<Tag>()
        + tags
            .iter()
            .map(|tag| {
                tag.capacity() * std::mem::size_of::<String>()
                    + tag.iter().map(String::capacity).sum::<usize>()
            })
            .sum::<usize>();
    Ok(Entries { tags, allocated })
}
