use lkjstr_protocol::{
    ascii_to_bytes, bytes_to_ascii, bytes_to_hex, bytes_to_utf8, hex_to_bytes, try_hex_to_bytes,
    utf8_to_bytes,
};

#[test]
fn encodes_lowercase_hex_and_decodes_strict_hex() -> Result<(), String> {
    assert_eq!(bytes_to_hex(&[0, 15, 255]), "000fff");
    assert_eq!(
        hex_to_bytes("000fff").map_err(|error| error.to_string())?,
        vec![0, 15, 255]
    );
    assert_eq!(try_hex_to_bytes("AA"), None);
    assert_eq!(try_hex_to_bytes("abc"), None);
    Ok(())
}

#[test]
fn roundtrips_utf8_and_validates_ascii() -> Result<(), String> {
    let bytes = utf8_to_bytes("hello \u{2713}");
    assert_eq!(
        bytes_to_utf8(&bytes).map_err(|error| error.to_string())?,
        "hello \u{2713}"
    );
    assert_eq!(ascii_to_bytes("abc"), Some(vec![97, 98, 99]));
    assert_eq!(ascii_to_bytes("\u{2713}"), None);
    assert_eq!(bytes_to_ascii(&[0x61, 0xff]), None);
    Ok(())
}
