//! Host entropy for salts, nonces, auxiliary randomness and ephemeral keys.
/// Fresh cryptographic bytes; a browser RNG failure is never replaced with a fallback.
pub fn random_bytes<const N: usize>() -> Result<[u8; N], &'static str> {
    let mut bytes = [0u8; N];
    getrandom::getrandom(&mut bytes).map_err(|_| "internal")?;
    Ok(bytes)
}
