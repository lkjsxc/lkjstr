//! Signed BOLT11 invoice inspection for NIP-57, not a Lightning payment engine.
//! Does not interpret routing, payment features, balances, or payment status.
use crate::{
    Error, Result,
    invoice_wire::{amount, bytes, integer},
};
use bech32::{Bech32, Fe32, primitives::decode::CheckedHrpstring};
use k256::ecdsa::{RecoveryId, Signature, VerifyingKey, signature::hazmat::PrehashVerifier};
use sha2::{Digest, Sha256};

/// Cryptographically checked invoice facts. Fields cannot be forged by callers.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Invoice {
    amount_msat: Option<u64>,
    payment_hash: [u8; 32],
    description_hash: Option<[u8; 32]>,
    timestamp: u64,
    expiry: u64,
    payee: [u8; 33],
}
impl Invoice {
    /// Parse up to 16 KiB of Bech32 and verify the ECDSA signature or recovered
    /// payee key. Fixed-size fields, duplicates, and description exclusivity are
    /// checked. Unknown fields are ignored for inspection, not payment approval.
    pub fn parse(encoded: &str) -> Result<Self> {
        if encoded.len() > 16384 {
            return Err(Error::Size);
        }
        let checked = CheckedHrpstring::new::<Bech32>(encoded).map_err(|_| Error::Invalid)?;
        let hrp = checked.hrp().as_str().to_ascii_lowercase();
        let amount_msat = amount(&hrp)?;
        let words: Vec<u8> = checked
            .data_part_ascii_no_checksum()
            .iter()
            .map(|c| {
                Fe32::from_char(*c as char)
                    .map(|w| w.to_u8())
                    .map_err(|_| Error::Invalid)
            })
            .collect::<Result<_>>()?;
        if words.len() < 7 + 104 {
            return Err(Error::Invalid);
        }
        let split = words.len() - 104;
        let signature = bytes(&words[split..], false)?;
        let mut digest = Sha256::new();
        digest.update(hrp.as_bytes());
        digest.update(bytes(&words[..split], true)?);
        let hash: [u8; 32] = digest.finalize().into();
        let sig = Signature::from_slice(&signature[..64]).map_err(|_| Error::Signature)?;
        let mut recovery = RecoveryId::from_byte(signature[64]).ok_or(Error::Signature)?;
        let mut p = None;
        let mut h = None;
        let mut n: Option<[u8; 33]> = None;
        let mut has_description = false;
        let mut has_secret = false;
        let mut expiry = None;
        let mut offset = 7;
        while offset < split {
            let header = words
                .get(offset..offset + 3)
                .filter(|_| offset + 3 <= split)
                .ok_or(Error::Invalid)?;
            let len = ((header[1] as usize) << 5) | header[2] as usize;
            let field = words
                .get(offset + 3..offset + 3 + len)
                .filter(|_| offset + 3 + len <= split)
                .ok_or(Error::Invalid)?;
            match header[0] {
                1 => {
                    if p.replace(
                        bytes(field, false)?
                            .try_into()
                            .map_err(|_| Error::Invalid)?,
                    )
                    .is_some()
                    {
                        return Err(Error::Invalid);
                    }
                }
                23 => {
                    if h.replace(
                        bytes(field, false)?
                            .try_into()
                            .map_err(|_| Error::Invalid)?,
                    )
                    .is_some()
                    {
                        return Err(Error::Invalid);
                    }
                }
                19 => {
                    if n.replace(
                        bytes(field, false)?
                            .try_into()
                            .map_err(|_| Error::Invalid)?,
                    )
                    .is_some()
                    {
                        return Err(Error::Invalid);
                    }
                }
                16 => {
                    if has_secret || bytes(field, false)?.len() != 32 {
                        return Err(Error::Invalid);
                    }
                    has_secret = true;
                }
                13 => {
                    if has_description || std::str::from_utf8(&bytes(field, false)?).is_err() {
                        return Err(Error::Invalid);
                    }
                    has_description = true;
                }
                6 if expiry.replace(integer(field)?).is_some() => return Err(Error::Invalid),
                _ => {}
            }
            offset += 3 + len;
        }
        if has_description == h.is_some() || !has_secret {
            return Err(Error::Invalid);
        }
        let key = if let Some(payee) = n {
            let key = VerifyingKey::from_sec1_bytes(&payee).map_err(|_| Error::Key)?;
            key.verify_prehash(&hash, &sig)
                .map_err(|_| Error::Signature)?;
            key
        } else {
            // k256 verifies low-S only; preserve recovery semantics for high-S.
            let sig = if let Some(low) = sig.normalize_s() {
                recovery = RecoveryId::new(!recovery.is_y_odd(), recovery.is_x_reduced());
                low
            } else {
                sig
            };
            VerifyingKey::recover_from_prehash(&hash, &sig, recovery)
                .map_err(|_| Error::Signature)?
        };
        Ok(Self {
            amount_msat,
            payment_hash: p.ok_or(Error::Invalid)?,
            description_hash: h,
            timestamp: integer(&words[..7])?,
            expiry: expiry.unwrap_or(3600),
            payee: key
                .to_encoded_point(true)
                .as_bytes()
                .try_into()
                .map_err(|_| Error::Key)?,
        })
    }
    /// Exact amount in millisatoshis, or an amountless invoice.
    pub fn amount_msat(&self) -> Option<u64> {
        self.amount_msat
    }
    /// Payment hash against which a provided preimage can be checked.
    pub fn payment_hash(&self) -> &[u8; 32] {
        &self.payment_hash
    }
    /// Description hash (zaps require this rather than a plain description).
    pub fn description_hash(&self) -> Option<&[u8; 32]> {
        self.description_hash.as_ref()
    }
    /// Invoice creation time.
    pub fn timestamp(&self) -> u64 {
        self.timestamp
    }
    /// Expiry interval; receipts can refer to historical invoices.
    pub fn expiry(&self) -> u64 {
        self.expiry
    }
    /// Compressed Lightning node public key, not the Nostr provider key.
    pub fn payee(&self) -> &[u8; 33] {
        &self.payee
    }
}
