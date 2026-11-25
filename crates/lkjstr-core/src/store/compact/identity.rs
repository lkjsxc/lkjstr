use super::Id;

/// Validate fixed-size fields once, before changing indexes or packing payloads.
pub(crate) struct Encoding {
    pub(super) id: Id,
    pub(super) author: Id,
    pub(super) sig: [u8; 64],
}
impl Encoding {
    pub(crate) fn of(event: &lkjstr_protocol::NostrEvent) -> Result<Self, &'static str> {
        Ok(Self {
            id: decode_id(&event.id).ok_or("invalid compact event id")?,
            author: decode_id(&event.pubkey).ok_or("invalid compact event pubkey")?,
            sig: decode::<64>(&event.sig).ok_or("invalid compact event signature")?,
        })
    }
    pub(crate) fn id(&self) -> Id {
        self.id
    }
    pub(crate) fn author(&self) -> Id {
        self.author
    }
}

pub fn decode_id(value: &str) -> Option<Id> {
    decode(value)
}
pub fn encode_id(value: &Id) -> String {
    hex(value)
}
pub fn hex(value: &[u8]) -> String {
    lkjstr_protocol::bytes_to_hex(value)
}
pub(super) fn decode<const N: usize>(value: &str) -> Option<[u8; N]> {
    if value.len() != N * 2 {
        return None;
    }
    let mut out = [0; N];
    for (byte, pair) in out.iter_mut().zip(value.as_bytes().as_chunks::<2>().0) {
        *byte = nibble(pair[0])? * 16 + nibble(pair[1])?;
    }
    Some(out)
}
fn nibble(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        _ => None,
    }
}
