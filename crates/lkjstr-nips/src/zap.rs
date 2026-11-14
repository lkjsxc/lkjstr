//! NIP-57 zap requests and receipts. LNURL provider identity is an explicit input.
use crate::{
    Error, Result,
    address::Coordinate,
    event::{Event, unique},
    invoice::Invoice,
    metadata::decimal,
    relay::relay_url,
    unhex,
};
use sha2::{Digest, Sha256};

/// Structurally valid and authenticated zap request.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ZapRequest {
    /// Recipient key.
    pub recipient: String,
    /// Optional event ID being zapped.
    pub event: Option<String>,
    /// Optional addressable event coordinate.
    pub address: Option<Coordinate>,
    /// Declared amount, if present, in millisatoshis.
    pub amount_msat: Option<u64>,
    /// LNURL string, compared to externally fetched recipient metadata.
    pub lnurl: Option<String>,
    /// Receipt publication relays.
    pub relays: Vec<String>,
    /// Optional restriction to a particular provider signer.
    pub provider: Option<String>,
}
impl ZapRequest {
    /// Verify signature, kind, cardinality and tag formats.
    pub fn parse(event: &Event) -> Result<Self> {
        event.verify()?;
        if event.data.kind != 9734 {
            return Err(Error::Invalid);
        }
        let tags = &event.data.tags;
        let recipient = unique(tags, "p")?.ok_or(Error::Invalid)?.to_owned();
        unhex::<32>(&recipient)?;
        let target = unique(tags, "e")?;
        if let Some(id) = target {
            unhex::<32>(id)?;
        }
        let provider = unique(tags, "P")?;
        if let Some(key) = provider {
            unhex::<32>(key)?;
        }
        let address = unique(tags, "a")?.map(Coordinate::parse).transpose()?;
        let amount_msat = unique(tags, "amount")?.map(decimal).transpose()?;
        if amount_msat == Some(0) {
            return Err(Error::Invalid);
        }
        if let Some(k) = unique(tags, "k")? {
            k.parse::<u16>().map_err(|_| Error::Invalid)?;
        }
        let lnurl = unique(tags, "lnurl")?.map(str::to_owned);
        if let Some(value) = &lnurl {
            validate_lnurl(value)?;
        }
        unique(tags, "relays")?.ok_or(Error::Invalid)?;
        let relays = tags
            .iter()
            .find(|t| t.first().is_some_and(|n| n == "relays"))
            .ok_or(Error::Invalid)?
            .iter()
            .skip(1)
            .map(|r| relay_url(r))
            .collect::<Result<Vec<_>>>()?;
        if relays.is_empty() {
            return Err(Error::Invalid);
        }
        Ok(Self {
            recipient,
            event: target.map(str::to_owned),
            address,
            amount_msat,
            lnurl,
            relays,
            provider: provider.map(str::to_owned),
        })
    }
    /// Server-side callback amount/provider checks in addition to parsing.
    pub fn validate_callback(&self, query_amount_msat: u64, provider: &str) -> Result<()> {
        if query_amount_msat == 0
            || self.amount_msat.is_some_and(|n| n != query_amount_msat)
            || self.provider.as_deref().is_some_and(|p| p != provider)
        {
            return Err(Error::Identity);
        }
        Ok(())
    }
}

fn validate_lnurl(encoded: &str) -> Result<()> {
    use bech32::{Bech32, primitives::decode::CheckedHrpstring};
    if encoded.len() > 5000 {
        return Err(Error::Size);
    }
    let checked = CheckedHrpstring::new::<Bech32>(encoded).map_err(|_| Error::Invalid)?;
    if !checked.hrp().as_str().eq_ignore_ascii_case("lnurl") {
        return Err(Error::Invalid);
    }
    let bytes: Vec<_> = checked.byte_iter().collect();
    let canonical = bech32::encode::<Bech32>(checked.hrp(), &bytes).map_err(|_| Error::Invalid)?;
    if canonical != encoded.to_ascii_lowercase() {
        return Err(Error::Invalid);
    }
    let value = std::str::from_utf8(&bytes).map_err(|_| Error::Invalid)?;
    let url = url::Url::parse(value).map_err(|_| Error::Invalid)?;
    if !matches!(url.scheme(), "https" | "http")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
    {
        return Err(Error::Invalid);
    }
    Ok(())
}
/// Receipt whose provider identity, request, invoice and targets were checked.
#[derive(Clone, Debug)]
pub struct ZapReceipt {
    /// Signed zap request embedded in the receipt description.
    pub request: Event,
    /// Parsed request metadata.
    pub details: ZapRequest,
    /// Cryptographically checked invoice.
    pub invoice: Invoice,
}
/// Verify a receipt against `nostrPubkey` and LNURL from the recipient's trusted
/// LNURL-pay discovery. Exact description bytes are hashed, never reserialized.
pub fn validate_receipt(
    receipt: &Event,
    provider_pubkey: &str,
    recipient_lnurl: Option<&str>,
) -> Result<ZapReceipt> {
    receipt.verify()?;
    if receipt.data.kind != 9735 || receipt.data.pubkey != provider_pubkey {
        return Err(Error::Identity);
    }
    let tags = &receipt.data.tags;
    let description = unique(tags, "description")?.ok_or(Error::Invalid)?;
    let request = Event::parse(description, crate::nip44::MAX_PLAINTEXT)?;
    let details = ZapRequest::parse(&request)?;
    let invoice = Invoice::parse(unique(tags, "bolt11")?.ok_or(Error::Invalid)?)?;
    let description_hash: [u8; 32] = Sha256::digest(description.as_bytes()).into();
    if invoice.description_hash() != Some(&description_hash) {
        return Err(Error::Authentication);
    }
    let amount = invoice.amount_msat().ok_or(Error::Invalid)?;
    details.validate_callback(amount, provider_pubkey)?;
    if unique(tags, "p")? != Some(details.recipient.as_str())
        || unique(tags, "e")? != details.event.as_deref()
        || unique(tags, "a")?.map(Coordinate::parse).transpose()? != details.address
        || unique(tags, "P")?.is_some_and(|p| p != request.data.pubkey)
        || recipient_lnurl
            .zip(details.lnurl.as_deref())
            .is_some_and(|(a, b)| a != b)
    {
        return Err(Error::Identity);
    }
    if let Some(preimage) = unique(tags, "preimage")? {
        let hash: [u8; 32] = Sha256::digest(unhex::<32>(preimage)?).into();
        if &hash != invoice.payment_hash() {
            return Err(Error::Authentication);
        }
    }
    Ok(ZapReceipt {
        request,
        details,
        invoice,
    })
}
