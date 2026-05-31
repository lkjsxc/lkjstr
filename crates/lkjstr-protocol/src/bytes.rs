use crate::ProtocolError;

pub fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub fn hex_to_bytes(hex: &str) -> Result<Vec<u8>, ProtocolError> {
    try_hex_to_bytes(hex).ok_or(ProtocolError::InvalidHex)
}

pub fn try_hex_to_bytes(hex: &str) -> Option<Vec<u8>> {
    if !hex.len().is_multiple_of(2) || !is_lower_hex(hex) {
        return None;
    }
    let mut bytes = Vec::with_capacity(hex.len() / 2);
    let mut index = 0;
    while index < hex.len() {
        let pair = hex.get(index..index + 2)?;
        bytes.push(u8::from_str_radix(pair, 16).ok()?);
        index += 2;
    }
    Some(bytes)
}

pub fn is_lower_hex(value: &str) -> bool {
    value
        .bytes()
        .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

pub fn utf8_to_bytes(text: &str) -> Vec<u8> {
    text.as_bytes().to_vec()
}

pub fn bytes_to_utf8(bytes: &[u8]) -> Result<String, ProtocolError> {
    String::from_utf8(bytes.to_vec()).map_err(|_| ProtocolError::InvalidUtf8)
}

pub fn ascii_to_bytes(text: &str) -> Option<Vec<u8>> {
    if text.is_ascii() {
        Some(text.as_bytes().to_vec())
    } else {
        None
    }
}

pub fn bytes_to_ascii(bytes: &[u8]) -> Option<String> {
    if bytes.is_ascii() {
        bytes_to_utf8(bytes).ok()
    } else {
        None
    }
}
