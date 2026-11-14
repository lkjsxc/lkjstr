//! Explicit key handling and raw BIP-340 signatures.
use crate::{Error, Result, hex};
use k256::schnorr::{Signature, SigningKey, VerifyingKey};
use zeroize::Zeroizing;

/// Validated secret scalar. Debug is redacted; memory is zeroized on drop.
#[derive(Clone)]
pub struct SecretKey {
    bytes: Zeroizing<[u8; 32]>,
    public: [u8; 32],
}
impl core::fmt::Debug for SecretKey {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str("SecretKey([REDACTED])")
    }
}
impl SecretKey {
    /// Validate a scalar in `[1, n-1]`. Randomness is supplied by the host.
    pub fn from_bytes(bytes: [u8; 32]) -> Result<Self> {
        let bytes = Zeroizing::new(bytes);
        let key = SigningKey::from_bytes(bytes.as_slice()).map_err(|_| Error::Key)?;
        Ok(Self {
            bytes,
            public: key.verifying_key().to_bytes().into(),
        })
    }
    /// Explicit secret access for cryptography or user-authorized export.
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.bytes
    }
    /// Lowercase x-only public key.
    pub fn public_key(&self) -> String {
        hex(&self.public_bytes())
    }
    /// X-only BIP-340 public key.
    pub fn public_bytes(&self) -> [u8; 32] {
        self.public
    }
    /// Raw BIP-340 signing, without hashing the message a second time.
    pub fn sign(&self, message: &[u8], auxiliary: &[u8; 32]) -> Result<[u8; 64]> {
        let key = SigningKey::from_bytes(self.as_bytes()).map_err(|_| Error::Key)?;
        Ok(key
            .sign_raw(message, auxiliary)
            .map_err(|_| Error::Signature)?
            .to_bytes())
    }
}
/// Verify a raw BIP-340 signature, including arbitrary-length official vectors.
pub fn verify(pubkey: &[u8; 32], message: &[u8], signature: &[u8; 64]) -> Result<()> {
    let key = VerifyingKey::from_bytes(pubkey).map_err(|_| Error::Key)?;
    let sig = Signature::try_from(signature.as_slice()).map_err(|_| Error::Signature)?;
    key.verify_raw(message, &sig).map_err(|_| Error::Signature)
}
