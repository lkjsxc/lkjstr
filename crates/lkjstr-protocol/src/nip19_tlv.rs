use std::collections::BTreeMap;

use crate::{bytes_to_hex, hex_to_bytes};

pub type TlvRecords = BTreeMap<u8, Vec<Vec<u8>>>;

pub fn encode_tlv(records: &TlvRecords) -> Option<Vec<u8>> {
    let mut bytes = Vec::new();
    for (record_type, values) in records {
        for value in values {
            let length = u8::try_from(value.len()).ok()?;
            bytes.push(*record_type);
            bytes.push(length);
            bytes.extend(value);
        }
    }
    Some(bytes)
}

pub fn decode_tlv(bytes: &[u8]) -> Option<TlvRecords> {
    let mut records: TlvRecords = BTreeMap::new();
    let mut index = 0;
    while index < bytes.len() {
        let record_type = *bytes.get(index)?;
        let length = usize::from(*bytes.get(index + 1)?);
        index += 2;
        let end = index.checked_add(length)?;
        let value = bytes.get(index..end)?;
        records.entry(record_type).or_default().push(value.to_vec());
        index = end;
    }
    Some(records)
}

pub fn first_hex(records: &TlvRecords, key: u8) -> Option<String> {
    let value = first_value(records, key)?;
    if value.len() == 32 {
        Some(bytes_to_hex(value))
    } else {
        None
    }
}

pub fn first_text(records: &TlvRecords, key: u8) -> Option<String> {
    let value = first_value(records, key)?;
    String::from_utf8(value.to_vec()).ok()
}

pub fn relays(records: &TlvRecords) -> Option<Vec<String>> {
    let relays: Vec<String> = records
        .get(&1)
        .into_iter()
        .flatten()
        .filter_map(|value| String::from_utf8(value.clone()).ok())
        .filter(|relay| !relay.is_empty())
        .collect();
    if relays.is_empty() {
        None
    } else {
        Some(relays)
    }
}

pub fn first_kind(records: &TlvRecords, key: u8) -> Option<u64> {
    let value = first_value(records, key)?;
    let bytes: [u8; 4] = value.as_slice().try_into().ok()?;
    Some(u64::from(u32::from_be_bytes(bytes)))
}

pub fn has_first(records: &TlvRecords, key: u8) -> bool {
    first_value(records, key).is_some()
}

pub fn hex_value(hex: &str) -> Option<Vec<u8>> {
    let bytes = hex_to_bytes(hex).ok()?;
    if bytes.len() == 32 { Some(bytes) } else { None }
}

pub fn text_value(text: &str) -> Vec<u8> {
    text.as_bytes().to_vec()
}

pub fn kind_value(kind: u64) -> Option<Vec<u8>> {
    let kind = u32::try_from(kind).ok()?;
    Some(kind.to_be_bytes().to_vec())
}

pub fn add_relays(records: &mut TlvRecords, relay_values: Option<&[String]>) {
    if let Some(relays) = relay_values
        && !relays.is_empty()
    {
        records.insert(1, relays.iter().map(|relay| text_value(relay)).collect());
    }
}

fn first_value(records: &TlvRecords, key: u8) -> Option<&Vec<u8>> {
    records.get(&key)?.first()
}
