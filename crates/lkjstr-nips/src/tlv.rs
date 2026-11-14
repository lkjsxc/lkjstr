use crate::{Error, Result};
#[derive(Default)]
pub(crate) struct Tlv {
    pub special: Option<Vec<u8>>,
    pub relays: Vec<String>,
    pub author: Option<[u8; 32]>,
    pub kind: Option<u32>,
}
pub(crate) fn parse(mut bytes: &[u8], event_metadata: bool) -> Result<Tlv> {
    let mut result = Tlv::default();
    while !bytes.is_empty() {
        if bytes.len() < 2 {
            return Err(Error::Invalid);
        }
        let (kind, len) = (bytes[0], bytes[1] as usize);
        bytes = &bytes[2..];
        let value = bytes.get(..len).ok_or(Error::Invalid)?;
        match kind {
            0 => {
                if result.special.replace(value.to_vec()).is_some() {
                    return Err(Error::Invalid);
                }
            }
            1 => result.relays.push(
                std::str::from_utf8(value)
                    .map_err(|_| Error::Invalid)?
                    .to_owned(),
            ),
            2 if event_metadata => {
                let key = value.try_into().map_err(|_| Error::Invalid)?;
                if result.author.replace(key).is_some() {
                    return Err(Error::Invalid);
                }
            }
            3 if event_metadata => {
                let data = value.try_into().map_err(|_| Error::Invalid)?;
                if result.kind.replace(u32::from_be_bytes(data)).is_some() {
                    return Err(Error::Invalid);
                }
            }
            _ => {} // NIP-19 requires unknown TLV types to be ignored.
        }
        bytes = &bytes[len..];
    }
    Ok(result)
}
pub(crate) fn push(bytes: &mut Vec<u8>, kind: u8, value: &[u8]) -> Result<()> {
    let len = u8::try_from(value.len()).map_err(|_| Error::Size)?;
    bytes.extend_from_slice(&[kind, len]);
    bytes.extend_from_slice(value);
    Ok(())
}
