//! LNURL encoding and invoice commitments. Network policy remains in core.
use crate::{Error, Result, bech32_checksum::ProtocolBech32, invoice::Invoice};
use bech32::{Hrp, primitives::decode::CheckedHrpstring};
use sha2::{Digest, Sha256};

/// Maximum encoded LNURL accepted by the existing NIP-57 codec.
pub const MAX_ENCODED: usize = 5000;

/// Encode an absolute HTTP(S) endpoint using original Bech32, without I/O.
pub fn encode(endpoint: &str) -> Result<String> {
    absolute(endpoint)?;
    let hrp = Hrp::parse("lnurl").map_err(|_| Error::Invalid)?;
    bech32::encode::<ProtocolBech32<MAX_ENCODED>>(hrp, endpoint.as_bytes()).map_err(|_| Error::Size)
}

/// Decode original Bech32 and reject mixed case, bad padding and non-URL bytes.
pub fn decode(encoded: &str) -> Result<String> {
    if encoded.len() > MAX_ENCODED {
        return Err(Error::Size);
    }
    let checked = CheckedHrpstring::new::<ProtocolBech32<MAX_ENCODED>>(encoded)
        .map_err(|_| Error::Invalid)?;
    if !checked.hrp().as_str().eq_ignore_ascii_case("lnurl") {
        return Err(Error::Invalid);
    }
    let bytes: Vec<_> = checked.byte_iter().collect();
    let value = String::from_utf8(bytes).map_err(|_| Error::Invalid)?;
    if encode(&value)? != encoded.to_ascii_lowercase() {
        return Err(Error::Invalid);
    }
    Ok(value)
}

fn absolute(endpoint: &str) -> Result<()> {
    if endpoint.len() > 3000 {
        return Err(Error::Size);
    }
    let url = url::Url::parse(endpoint).map_err(|_| Error::Invalid)?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
    {
        return Err(Error::Invalid);
    }
    Ok(())
}

/// Validate a lowercase x-only BIP-340 point, not merely a 32-byte hex string.
pub fn public_key(value: &str) -> Result<()> {
    k256::schnorr::VerifyingKey::from_bytes(&crate::unhex::<32>(value)?)
        .map(|_| ())
        .map_err(|_| Error::Key)
}

/// Check the signed invoice's exact amount and SHA-256 description commitment.
/// The caller supplies the NIP-57 request's original JSON bytes, not LNURL metadata.
/// Currency, current expiry and policy bounds are checked by the calling engine.
pub fn invoice(encoded: &str, description: &[u8], amount_msat: u64) -> Result<Invoice> {
    let invoice = Invoice::parse(encoded)?;
    let hash: [u8; 32] = Sha256::digest(description).into();
    if amount_msat == 0
        || invoice.amount_msat() != Some(amount_msat)
        || invoice.description_hash() != Some(&hash)
    {
        return Err(Error::Authentication);
    }
    Ok(invoice)
}
