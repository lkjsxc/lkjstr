use bech32::{Bech32, Hrp};

use crate::{AddressPointer, EventPointer, Nip19Error, NostrEntity, ProfilePointer, nip19_tlv};

pub fn encode_nip19(entity: &NostrEntity) -> Result<String, Nip19Error> {
    match entity {
        NostrEntity::Npub(pubkey) => encode_npub(pubkey),
        NostrEntity::Nsec(secret) => encode_nsec(secret),
        NostrEntity::Note(id) => encode_note(id),
        NostrEntity::Nprofile(pointer) => encode_nprofile(pointer),
        NostrEntity::Nevent(pointer) => encode_nevent(pointer),
        NostrEntity::Naddr(pointer) => encode_naddr(pointer),
    }
}

pub fn encode_npub(pubkey: &str) -> Result<String, Nip19Error> {
    encode_hex("npub", pubkey)
}

pub fn encode_nsec(secret: &str) -> Result<String, Nip19Error> {
    encode_hex("nsec", secret)
}

pub fn encode_note(id: &str) -> Result<String, Nip19Error> {
    encode_hex("note", id)
}

pub fn encode_nprofile(pointer: &ProfilePointer) -> Result<String, Nip19Error> {
    let mut records = relayed_records(pointer.relays.as_deref());
    records.insert(0, vec![fixed_hex(&pointer.pubkey)?]);
    encode_records("nprofile", &records)
}

pub fn encode_nevent(pointer: &EventPointer) -> Result<String, Nip19Error> {
    let mut records = relayed_records(pointer.relays.as_deref());
    records.insert(0, vec![fixed_hex(&pointer.id)?]);
    if let Some(author) = &pointer.author {
        records.insert(2, vec![fixed_hex(author)?]);
    }
    if let Some(kind) = pointer.kind {
        records.insert(
            3,
            vec![nip19_tlv::kind_value(kind).ok_or(Nip19Error::InvalidTlv)?],
        );
    }
    encode_records("nevent", &records)
}

pub fn encode_naddr(pointer: &AddressPointer) -> Result<String, Nip19Error> {
    let mut records = relayed_records(pointer.relays.as_deref());
    records.insert(0, vec![nip19_tlv::text_value(&pointer.identifier)]);
    records.insert(2, vec![fixed_hex(&pointer.pubkey)?]);
    records.insert(
        3,
        vec![nip19_tlv::kind_value(pointer.kind).ok_or(Nip19Error::InvalidTlv)?],
    );
    encode_records("naddr", &records)
}

fn relayed_records(relays: Option<&[String]>) -> nip19_tlv::TlvRecords {
    let mut records = nip19_tlv::TlvRecords::new();
    nip19_tlv::add_relays(&mut records, relays);
    records
}

fn encode_hex(prefix: &str, hex: &str) -> Result<String, Nip19Error> {
    encode_bytes(prefix, &fixed_hex(hex)?)
}

fn fixed_hex(hex: &str) -> Result<Vec<u8>, Nip19Error> {
    nip19_tlv::hex_value(hex).ok_or(Nip19Error::InvalidHex)
}

fn encode_records(prefix: &str, records: &nip19_tlv::TlvRecords) -> Result<String, Nip19Error> {
    let bytes = nip19_tlv::encode_tlv(records).ok_or(Nip19Error::InvalidTlv)?;
    encode_bytes(prefix, &bytes)
}

fn encode_bytes(prefix: &str, bytes: &[u8]) -> Result<String, Nip19Error> {
    let hrp = Hrp::parse(prefix).map_err(|_| Nip19Error::InvalidPrefix)?;
    bech32::encode::<Bech32>(hrp, bytes).map_err(|_| Nip19Error::InvalidEntity)
}
