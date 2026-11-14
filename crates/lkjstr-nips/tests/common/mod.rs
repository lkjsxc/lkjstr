#![allow(dead_code, clippy::unwrap_used)]
use lkjstr_nips::{
    event::{Event, Tag, UnsignedEvent},
    keys::SecretKey,
};
pub mod invoices;

pub fn key(byte: u8) -> SecretKey {
    SecretKey::from_bytes([byte; 32]).unwrap()
}
pub fn tag(fields: &[&str]) -> Tag {
    fields.iter().map(|s| (*s).into()).collect()
}
pub fn unsigned(kind: u16, tags: Vec<Tag>, content: &str) -> UnsignedEvent {
    UnsignedEvent::new(key(1).public_key(), 1700000000, kind, tags, content)
}
pub fn event(kind: u16, tags: Vec<Tag>, content: &str) -> Event {
    unsigned(kind, tags, content)
        .sign(&key(1), &[3; 32])
        .unwrap()
}
pub fn bytes(input: &str) -> Vec<u8> {
    assert!(input.len().is_multiple_of(2));
    (0..input.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&input[i..i + 2], 16).unwrap())
        .collect()
}
pub fn fixed<const N: usize>(input: &str) -> [u8; N] {
    bytes(input).try_into().unwrap()
}
