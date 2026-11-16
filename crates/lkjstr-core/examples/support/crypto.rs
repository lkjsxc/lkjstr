//! Test-signer crypto for loopback conformance. Secret scalars never leave the helper.
pub fn crypt(
    bytes: &[u8; 32],
    operation: &str,
    peer: &str,
    data: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    let key = lkjstr_nips::keys::SecretKey::from_bytes(*bytes)?;
    let peer = lkjstr_nips::unhex::<32>(peer)?;
    if operation == "nip04.decrypt" || operation == "nip04_decrypt" {
        return Ok(lkjstr_nips::nip04::decrypt(data, &key, &peer)?);
    }
    let conversation = lkjstr_nips::nip44::conversation_key(&key, &peer)?;
    match operation {
        "nip44.encrypt" | "nip44_encrypt" => Ok(lkjstr_nips::nip44::encrypt(
            data,
            &conversation,
            lkjstr_protocol::generate_secret_key().as_bytes(),
        )?),
        "nip44.decrypt" | "nip44_decrypt" => Ok(lkjstr_nips::nip44::decrypt(data, &conversation)?),
        _ => Err("unsupported fixture crypto".into()),
    }
}
