//! HTTP upload authentication and strict response decoding for Blossom/NIP-96.
use crate::UnsignedNostrEvent;
use base64::{Engine as _, engine::general_purpose::STANDARD};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
pub fn method(blossom: bool) -> &'static str {
    if blossom { "PUT" } else { "POST" }
}
pub fn hash(bytes: &[u8]) -> String {
    crate::bytes_to_hex(&Sha256::digest(bytes))
}
pub fn auth(pubkey: String, at: u64, url: &str, hash: &str, blossom: bool) -> UnsignedNostrEvent {
    UnsignedNostrEvent {
        pubkey,
        created_at: at,
        kind: if blossom { 24242 } else { 27235 },
        content: if blossom {
            "Upload file".into()
        } else {
            String::new()
        },
        tags: if blossom {
            vec![
                vec!["t".into(), "upload".into()],
                vec!["x".into(), hash.into()],
                vec!["expiration".into(), (at + 300).to_string()],
            ]
        } else {
            vec![
                vec!["u".into(), url.into()],
                vec!["method".into(), "POST".into()],
            ]
        },
    }
}
pub fn authorization(event: &crate::NostrEvent) -> Result<String, serde_json::Error> {
    Ok(format!(
        "Nostr {}",
        STANDARD.encode(serde_json::to_vec(event)?)
    ))
}
pub fn uploaded(body: &str, mime: &str, hash: &str, blossom: bool) -> Option<Value> {
    let value: Value = serde_json::from_str(body).ok()?;
    let (url, sha, mime) = if blossom {
        if value["sha256"].as_str()? != hash {
            return None;
        }
        (
            value["url"].as_str()?.to_owned(),
            hash.to_owned(),
            value["type"].as_str().unwrap_or(mime).to_owned(),
        )
    } else {
        if value["status"] != "success" {
            return None;
        }
        let tags = value["nip94_event"]["tags"].as_array()?;
        let tag = |key: &str| {
            tags.iter()
                .find(|t| t[0] == key)
                .and_then(|t| t[1].as_str())
        };
        if tag("ox")? != hash {
            return None;
        }
        (
            tag("url")?.to_owned(),
            tag("x").unwrap_or(hash).to_owned(),
            tag("m").unwrap_or(mime).to_owned(),
        )
    };
    let parsed = url::Url::parse(&url).ok()?;
    if parsed.scheme() != "https"
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return None;
    }
    let kind = if mime.starts_with("image/") {
        "image"
    } else if mime.starts_with("video/") {
        "video"
    } else if mime.starts_with("audio/") {
        "audio"
    } else {
        return None;
    };
    Some(json!({"url":url,"type":kind,"mime":mime,"sha256":sha}))
}
