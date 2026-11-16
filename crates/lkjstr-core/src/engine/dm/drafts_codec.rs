//! Authenticated bounded segments preserve the one-MiB NIP-44 message ceiling.
use super::{Catalog, MAX_CATALOG, PURPOSE, generation, storage_key};
use lkjstr_nips::nip44::{self, ConversationKey};
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

const SEGMENT_BYTES: usize = 256 * 1024;
const MAX_SEGMENTS: usize = MAX_CATALOG / SEGMENT_BYTES + 1;
pub const MAX_ARCHIVE: usize = 6 * 1024 * 1024;
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Envelope {
    pub version: u32,
    pub wrapped_seed: String,
    pub cipher_catalog: Vec<String>,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Segment {
    schema: u32,
    purpose: String,
    account: String,
    batch: String,
    part: usize,
    count: usize,
    bytes: usize,
}
impl Envelope {
    pub fn parse(raw: &str) -> Result<Self, &'static str> {
        if raw.len() > MAX_ARCHIVE {
            return Err("too-large");
        }
        let envelope: Self = serde_json::from_str(raw).map_err(|_| "rejected")?;
        if envelope.version != 1
            || envelope.wrapped_seed.len() < 132
            || envelope.wrapped_seed.len() > 4096
            || envelope.cipher_catalog.is_empty()
            || envelope.cipher_catalog.len() > MAX_SEGMENTS
            || envelope
                .cipher_catalog
                .iter()
                .any(|s| s.len() > nip44::MAX_PAYLOAD)
        {
            return Err("rejected");
        }
        Ok(envelope)
    }
    pub fn encoded(&self) -> Result<String, &'static str> {
        let raw = serde_json::to_string(self).map_err(|_| "internal")?;
        if raw.len() > MAX_ARCHIVE {
            return Err("too-large");
        }
        Ok(raw)
    }
}
pub fn seal(
    account: &str,
    catalog: &Catalog,
    key: &ConversationKey,
    wrapped_seed: String,
    batch: &str,
    mut nonce: impl FnMut() -> Result<[u8; 32], &'static str>,
) -> Result<Envelope, &'static str> {
    storage_key(account)?;
    if !generation(batch) {
        return Err("rejected");
    }
    let raw = catalog.encoded()?;
    let mut pieces = Vec::new();
    let mut begin = 0;
    while begin < raw.len() {
        let mut end = (begin + SEGMENT_BYTES).min(raw.len());
        while !raw.is_char_boundary(end) {
            end -= 1;
        }
        pieces.push(&raw[begin..end]);
        begin = end;
    }
    let mut cipher_catalog = Vec::new();
    for (part, text) in pieces.iter().enumerate() {
        let value = Segment {
            schema: 1,
            purpose: PURPOSE.into(),
            account: account.into(),
            batch: batch.into(),
            part,
            count: pieces.len(),
            bytes: text.len(),
        };
        let header = serde_json::to_string(&value).map_err(|_| "internal")?;
        let text = Zeroizing::new(format!("{header}\n{text}"));
        cipher_catalog.push(nip44::encrypt(&text, key, &nonce()?).map_err(|_| "rejected")?);
    }
    let envelope = Envelope {
        version: 1,
        wrapped_seed,
        cipher_catalog,
    };
    Envelope::parse(&envelope.encoded()?)
}
pub fn open(
    account: &str,
    envelope: &Envelope,
    key: &ConversationKey,
) -> Result<Catalog, &'static str> {
    storage_key(account)?;
    if envelope.version != 1
        || envelope.cipher_catalog.is_empty()
        || envelope.cipher_catalog.len() > MAX_SEGMENTS
    {
        return Err("rejected");
    }
    let mut raw = Zeroizing::new(String::new());
    let mut batch = None;
    for (part, cipher) in envelope.cipher_catalog.iter().enumerate() {
        let text = Zeroizing::new(nip44::decrypt(cipher, key).map_err(|_| "rejected")?);
        let (header, body) = text.split_once('\n').ok_or("rejected")?;
        if header.len() > 1024 {
            return Err("rejected");
        }
        let value: Segment = serde_json::from_str(header).map_err(|_| "rejected")?;
        if value.schema != 1
            || value.purpose != PURPOSE
            || value.account != account
            || value.part != part
            || value.count != envelope.cipher_catalog.len()
            || !generation(&value.batch)
            || body.len() > SEGMENT_BYTES
            || value.bytes != body.len()
            || batch.as_ref().is_some_and(|batch| *batch != value.batch)
        {
            return Err("rejected");
        }
        batch = Some(value.batch);
        if raw.len() + body.len() > MAX_CATALOG {
            return Err("too-large");
        }
        raw.push_str(body);
    }
    Catalog::from_json(&raw)
}
