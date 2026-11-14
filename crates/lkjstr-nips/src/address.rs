//! NIP-01 replaceable and addressable event coordinates.
use crate::{
    Error, Result,
    event::{UnsignedEvent, unique},
    unhex,
};

/// Parsed `kind:pubkey:d-tag` coordinate.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Coordinate {
    /// Replaceable or addressable kind.
    pub kind: u16,
    /// Lowercase author key.
    pub pubkey: String,
    /// Identifier; must be empty for normal replaceable events.
    pub identifier: String,
}
impl Coordinate {
    /// Parse with at most two splits so identifiers may contain colons.
    pub fn parse(value: &str) -> Result<Self> {
        let mut parts = value.splitn(3, ':');
        let kind: u16 = parts
            .next()
            .ok_or(Error::Invalid)?
            .parse()
            .map_err(|_| Error::Invalid)?;
        let pubkey = parts.next().ok_or(Error::Invalid)?;
        let identifier = parts.next().ok_or(Error::Invalid)?;
        unhex::<32>(pubkey)?;
        if !matches!(kind, 0 | 3 | 10000..=19999 | 30000..=39999)
            || (kind < 30000 && !identifier.is_empty())
        {
            return Err(Error::Invalid);
        }
        Ok(Self {
            kind,
            pubkey: pubkey.into(),
            identifier: identifier.into(),
        })
    }
    /// Coordinate of a replaceable/addressable event (empty identifier if absent).
    pub fn of(event: &UnsignedEvent) -> Result<Self> {
        let identifier = if event.kind >= 30000 {
            unique(&event.tags, "d")?.unwrap_or("")
        } else {
            ""
        };
        Self::parse(&format!("{}:{}:{}", event.kind, event.pubkey, identifier))
    }
}
impl core::fmt::Display for Coordinate {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "{}:{}:{}", self.kind, self.pubkey, self.identifier)
    }
}
