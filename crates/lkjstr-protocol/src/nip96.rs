use serde::{Deserialize, Serialize};
use serde_json::Value;
use url::Url;

use crate::NostrTag;

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct Nip96Server {
    pub api_url: Option<String>,
    pub delegated_to_url: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct Nip96UploadResult {
    pub url: String,
    pub tags: Vec<NostrTag>,
    pub imeta: NostrTag,
}

pub fn nip96_discovery_url(server: &str) -> Option<String> {
    let url = valid_https_url(server)?;
    Some(format!(
        "{}/.well-known/nostr/nip96.json",
        url.origin().ascii_serialization()
    ))
}

pub fn parse_nip96_server_value(value: &Value) -> Option<Nip96Server> {
    let object = value.as_object()?;
    let api_url = string_value(object.get("api_url")).or_else(|| string_value(object.get("url")));
    let delegated_to_url = string_value(object.get("delegated_to_url"));
    if api_url.is_none() && delegated_to_url.is_none() {
        return None;
    }
    Some(Nip96Server {
        api_url,
        delegated_to_url,
    })
}

pub fn parse_nip96_upload_result_value(value: &Value) -> Option<Nip96UploadResult> {
    let object = value.as_object()?;
    let tags = nip94_tags(value);
    let url = find_tag(&tags, "url").or_else(|| string_value(object.get("url")))?;
    if url.is_empty() {
        return None;
    }
    Some(Nip96UploadResult {
        url: url.to_owned(),
        imeta: imeta_tag(&url, &tags),
        tags,
    })
}

pub fn valid_https_url(value: &str) -> Option<Url> {
    Url::parse(value).ok().filter(|url| url.scheme() == "https")
}

fn nip94_tags(value: &Value) -> Vec<NostrTag> {
    let source = value
        .get("nip94_event")
        .and_then(Value::as_object)
        .and_then(|event| event.get("tags"))
        .or_else(|| value.get("tags"));
    source
        .and_then(Value::as_array)
        .map(|items| items.iter().filter_map(string_array).collect())
        .unwrap_or_default()
}

fn imeta_tag(url: &str, tags: &[NostrTag]) -> NostrTag {
    let mut parts = vec!["imeta".to_owned(), format!("url {url}")];
    for name in ["m", "dim", "blurhash", "x", "size"] {
        if let Some(value) = find_tag(tags, name).filter(|value| !value.is_empty()) {
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

fn string_value(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .filter(|item| !item.is_empty())
        .map(ToOwned::to_owned)
}

fn string_array(value: &Value) -> Option<NostrTag> {
    let mut tag = Vec::new();
    for item in value.as_array()? {
        tag.push(item.as_str()?.to_owned());
    }
    Some(tag)
}
