use serde_json::Value;

use crate::{
    NostrTag, UnsignedNostrEvent, is_lower_hex, kinds::KIND_BLOSSOM_AUTH, valid_https_url,
};

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct BlossomBlobDescriptor {
    pub url: String,
    pub sha256: String,
    pub size: Option<u64>,
    pub content_type: Option<String>,
    pub uploaded: Option<u64>,
    pub tags: Vec<NostrTag>,
    pub imeta: NostrTag,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct BlossomAuthInput {
    pub pubkey: String,
    pub endpoint: String,
    pub sha256: String,
    pub size: u64,
    pub created_at: u64,
    pub expiration: u64,
}

pub fn blossom_upload_endpoint(server: &str) -> Option<String> {
    let url = valid_https_url(server.trim())?;
    let path = url.path();
    if path.is_empty() || path == "/" {
        Some(format!("{}/upload", url.origin().ascii_serialization()))
    } else {
        Some(url.as_str().to_owned())
    }
}

pub fn blossom_upload_auth_event(input: BlossomAuthInput) -> UnsignedNostrEvent {
    UnsignedNostrEvent {
        pubkey: input.pubkey,
        created_at: input.created_at,
        kind: KIND_BLOSSOM_AUTH,
        tags: vec![
            vec!["t".to_owned(), "upload".to_owned()],
            vec!["x".to_owned(), input.sha256],
            vec!["u".to_owned(), input.endpoint],
            vec!["method".to_owned(), "PUT".to_owned()],
            vec!["size".to_owned(), input.size.to_string()],
            vec!["expiration".to_owned(), input.expiration.to_string()],
        ],
        content: String::new(),
    }
}

pub fn parse_blossom_blob_descriptor_value(
    value: &Value,
    expected_hash: &str,
    fallback_url: &str,
    fallback_type: Option<&str>,
    fallback_size: Option<u64>,
) -> Option<BlossomBlobDescriptor> {
    let object = value.as_object()?;
    let sha256 = hex64(object.get("sha256")).or_else(|| hex64(object.get("x")))?;
    if sha256 != expected_hash {
        return None;
    }
    let url = string_value(object.get("url")).unwrap_or_else(|| fallback_url.to_owned());
    let url = valid_https_url(&url)?.as_str().to_owned();
    let size = u64_value(object.get("size")).or(fallback_size);
    let content_type =
        string_value(object.get("type")).or_else(|| fallback_type.map(str::to_owned));
    let uploaded = u64_value(object.get("uploaded"));
    let tags = descriptor_tags(&url, &sha256, size, content_type.as_deref());
    Some(BlossomBlobDescriptor {
        url: url.clone(),
        sha256,
        size,
        content_type,
        uploaded,
        imeta: imeta_tag(&url, &tags),
        tags,
    })
}

fn descriptor_tags(
    url: &str,
    sha256: &str,
    size: Option<u64>,
    content_type: Option<&str>,
) -> Vec<NostrTag> {
    let mut tags = vec![
        vec!["url".to_owned(), url.to_owned()],
        vec!["x".to_owned(), sha256.to_owned()],
    ];
    if let Some(content_type) = content_type {
        tags.push(vec!["m".to_owned(), content_type.to_owned()]);
    }
    if let Some(size) = size {
        tags.push(vec!["size".to_owned(), size.to_string()]);
    }
    tags
}

fn imeta_tag(url: &str, tags: &[NostrTag]) -> NostrTag {
    let mut parts = vec!["imeta".to_owned(), format!("url {url}")];
    for name in ["m", "x", "size"] {
        if let Some(value) = find_tag(tags, name) {
            parts.push(format!("{name} {value}"));
        }
    }
    parts
}

fn find_tag(tags: &[NostrTag], name: &str) -> Option<String> {
    tags.iter()
        .find(|tag| tag.first().is_some_and(|item| item == name))
        .and_then(|tag| tag.get(1))
        .cloned()
}

fn hex64(value: Option<&Value>) -> Option<String> {
    let value = value?.as_str()?.to_ascii_lowercase();
    (value.len() == 64 && is_lower_hex(&value)).then_some(value)
}

fn string_value(value: Option<&Value>) -> Option<String> {
    value?
        .as_str()
        .filter(|item| !item.is_empty())
        .map(str::to_owned)
}

fn u64_value(value: Option<&Value>) -> Option<u64> {
    value?.as_u64()
}
