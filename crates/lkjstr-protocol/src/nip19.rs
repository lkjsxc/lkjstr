use std::fmt;

use bech32::{Bech32, Checksum, primitives::decode::CheckedHrpstring};
use serde::{Deserialize, Serialize};

use crate::{bytes_to_hex, nip19_tlv};

const BECH32_LIMIT: usize = 5000;

// NIP-19 keeps the original checksum but permits longer relay-hinted entities
// than the library's 1023-character code length. This does not extend the
// short-code error-detection guarantees of the checksum.
pub(crate) struct Nip19Bech32;
impl Checksum for Nip19Bech32 {
    type MidstateRepr = <Bech32 as Checksum>::MidstateRepr;
    const CODE_LENGTH: usize = BECH32_LIMIT;
    const CHECKSUM_LENGTH: usize = Bech32::CHECKSUM_LENGTH;
    const GENERATOR_SH: [Self::MidstateRepr; 5] = Bech32::GENERATOR_SH;
    const TARGET_RESIDUE: Self::MidstateRepr = Bech32::TARGET_RESIDUE;
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct ProfilePointer {
    pub pubkey: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relays: Option<Vec<String>>,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct EventPointer {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relays: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<u64>,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct AddressPointer {
    pub identifier: String,
    pub pubkey: String,
    pub kind: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relays: Option<Vec<String>>,
}

#[derive(Clone, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum NostrEntity {
    #[serde(rename = "npub")]
    Npub(String),
    #[serde(rename = "nsec")]
    Nsec(String),
    #[serde(rename = "note")]
    Note(String),
    #[serde(rename = "nprofile")]
    Nprofile(ProfilePointer),
    #[serde(rename = "nevent")]
    Nevent(EventPointer),
    #[serde(rename = "naddr")]
    Naddr(AddressPointer),
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub enum Nip19Error {
    InvalidEntity,
    InvalidPrefix,
    InvalidHex,
    InvalidTlv,
}

impl fmt::Debug for NostrEntity {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Npub(value) => formatter.debug_tuple("Npub").field(value).finish(),
            Self::Nsec(_) => formatter.debug_tuple("Nsec").field(&"<redacted>").finish(),
            Self::Note(value) => formatter.debug_tuple("Note").field(value).finish(),
            Self::Nprofile(value) => formatter.debug_tuple("Nprofile").field(value).finish(),
            Self::Nevent(value) => formatter.debug_tuple("Nevent").field(value).finish(),
            Self::Naddr(value) => formatter.debug_tuple("Naddr").field(value).finish(),
        }
    }
}

pub fn decode_nip19(value: &str) -> Option<NostrEntity> {
    if value.len() > BECH32_LIMIT {
        return None;
    }
    let checked = CheckedHrpstring::new::<Nip19Bech32>(value).ok()?;
    let hrp = checked.hrp();
    let bytes: Vec<_> = checked.byte_iter().collect();
    if bech32::encode::<Nip19Bech32>(hrp, &bytes).ok()? != value.to_ascii_lowercase() {
        return None;
    }
    match hrp.as_str().to_ascii_lowercase().as_str() {
        "npub" if bytes.len() == 32 => Some(NostrEntity::Npub(bytes_to_hex(&bytes))),
        "nsec" if bytes.len() == 32 => Some(NostrEntity::Nsec(bytes_to_hex(&bytes))),
        "note" if bytes.len() == 32 => Some(NostrEntity::Note(bytes_to_hex(&bytes))),
        "nprofile" => decode_nprofile(&bytes),
        "nevent" => decode_nevent(&bytes),
        "naddr" => decode_naddr(&bytes),
        _ => None,
    }
}

fn decode_nprofile(bytes: &[u8]) -> Option<NostrEntity> {
    let records = nip19_tlv::decode_tlv(bytes)?;
    let pubkey = nip19_tlv::first_hex(&records, 0)?;
    Some(NostrEntity::Nprofile(ProfilePointer {
        pubkey,
        relays: nip19_tlv::relays(&records),
    }))
}

fn decode_nevent(bytes: &[u8]) -> Option<NostrEntity> {
    let records = nip19_tlv::decode_tlv(bytes)?;
    let id = nip19_tlv::first_hex(&records, 0)?;
    let author = optional_hex(&records, 2)?;
    let kind = optional_kind(&records, 3)?;
    Some(NostrEntity::Nevent(EventPointer {
        id,
        relays: nip19_tlv::relays(&records),
        author,
        kind,
    }))
}

fn decode_naddr(bytes: &[u8]) -> Option<NostrEntity> {
    let records = nip19_tlv::decode_tlv(bytes)?;
    Some(NostrEntity::Naddr(AddressPointer {
        identifier: nip19_tlv::first_text(&records, 0)?,
        pubkey: nip19_tlv::first_hex(&records, 2)?,
        kind: nip19_tlv::first_kind(&records, 3)?,
        relays: nip19_tlv::relays(&records),
    }))
}

fn optional_hex(records: &nip19_tlv::TlvRecords, key: u8) -> Option<Option<String>> {
    if nip19_tlv::has_first(records, key) {
        Some(Some(nip19_tlv::first_hex(records, key)?))
    } else {
        Some(None)
    }
}

fn optional_kind(records: &nip19_tlv::TlvRecords, key: u8) -> Option<Option<u64>> {
    if nip19_tlv::has_first(records, key) {
        Some(Some(nip19_tlv::first_kind(records, key)?))
    } else {
        Some(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checksum_parameters_are_consistent() {
        Nip19Bech32::sanity_check();
    }
}
