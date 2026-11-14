//! Note text to display segments: text, links, media, mentions, quotes,
//! hashtags and custom emoji. Rendering never interprets HTML.

use lkjstr_protocol::{NostrEntity, decode_nip19};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Segment {
    Text(String),
    Link(String),
    Image(String),
    Video(String),
    Mention(String),
    Quote { id: String, relays: Vec<String> },
    Hashtag(String),
    Emoji { code: String, url: String },
}

const IMAGE_EXT: [&str; 7] = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg"];
const VIDEO_EXT: [&str; 4] = [".mp4", ".webm", ".mov", ".m4v"];

fn media_kind(url: &str) -> Segment {
    let path = url.split(['?', '#']).next().unwrap_or(url).to_lowercase();
    if IMAGE_EXT.iter().any(|ext| path.ends_with(ext)) {
        Segment::Image(url.to_owned())
    } else if VIDEO_EXT.iter().any(|ext| path.ends_with(ext)) {
        Segment::Video(url.to_owned())
    } else {
        Segment::Link(url.to_owned())
    }
}

fn token_end(text: &str) -> usize {
    text.find(|c: char| c.is_whitespace() || matches!(c, '<' | '>' | '"' | '\''))
        .unwrap_or(text.len())
}

/// Trailing punctuation usually belongs to the sentence, not the token.
fn trim_tail(token: &str) -> &str {
    let mut end = token.len();
    while end > 0 {
        let last = token[..end].chars().next_back().unwrap_or(' ');
        let unbalanced_paren = last == ')' && !token[..end].contains('(');
        if matches!(last, '.' | ',' | ';' | ':' | '!' | '?') || unbalanced_paren {
            end -= last.len_utf8();
        } else {
            break;
        }
    }
    &token[..end]
}

fn nostr_segment(entity: &str) -> Option<Segment> {
    Some(match decode_nip19(entity)? {
        NostrEntity::Npub(pubkey) => Segment::Mention(pubkey),
        NostrEntity::Nprofile(pointer) => Segment::Mention(pointer.pubkey),
        NostrEntity::Note(id) => Segment::Quote { id, relays: vec![] },
        NostrEntity::Nevent(pointer) => Segment::Quote {
            id: pointer.id,
            relays: pointer.relays.unwrap_or_default(),
        },
        _ => return None,
    })
}

/// Splits `content` into segments. `emoji` maps NIP-30 shortcodes to URLs.
pub fn segments(content: &str, emoji: &[(String, String)]) -> Vec<Segment> {
    let mut out: Vec<Segment> = Vec::new();
    let mut text = String::new();
    let mut rest = content;
    let push_text = |out: &mut Vec<Segment>, text: &mut String| {
        if !text.is_empty() {
            out.push(Segment::Text(std::mem::take(text)));
        }
    };
    let mut at_word_start = true;
    while let Some(ch) = rest.chars().next() {
        let token = &rest[..token_end(rest)];
        let trimmed = trim_tail(token);
        let found = if rest.starts_with("https://") || rest.starts_with("http://") {
            (trimmed.len() > 8).then(|| media_kind(trimmed))
        } else if let Some(entity) = trimmed.strip_prefix("nostr:") {
            nostr_segment(entity)
        } else if at_word_start && ch == '#' && trimmed.len() > 1 {
            let tag = &trimmed[1..];
            tag.chars()
                .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
                .then(|| Segment::Hashtag(tag.to_owned()))
        } else if ch == ':' {
            custom_emoji(rest, emoji)
        } else {
            None
        };
        match found {
            Some(segment) => {
                let used = match &segment {
                    Segment::Emoji { code, .. } => code.len() + 2,
                    _ => trimmed.len(),
                };
                push_text(&mut out, &mut text);
                out.push(segment);
                rest = &rest[used..];
                at_word_start = false;
            }
            None => {
                text.push(ch);
                rest = &rest[ch.len_utf8()..];
                at_word_start = ch.is_whitespace() || matches!(ch, '(' | '[');
            }
        }
    }
    push_text(&mut out, &mut text);
    out
}

fn custom_emoji(rest: &str, emoji: &[(String, String)]) -> Option<Segment> {
    let inner = &rest[1..];
    let end = inner.find(':')?;
    let code = &inner[..end];
    let (_, url) = emoji.iter().find(|(name, _)| name == code)?;
    Some(Segment::Emoji {
        code: code.to_owned(),
        url: url.clone(),
    })
}

/// Machine payloads posted as notes: JSON documents, or long unbroken runs of
/// base64/hex (encrypted or binary data). Global hides them.
pub fn looks_like_noise(content: &str) -> bool {
    let text = content.trim();
    let json_like = (text.starts_with('{') && text.ends_with('}'))
        || (text.starts_with('[') && text.ends_with(']'));
    if json_like && serde_json::from_str::<serde_json::Value>(text).is_ok() {
        return true;
    }
    if text.len() < 120 || text.contains(char::is_whitespace) {
        return false;
    }
    let encoded = text
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '/' | '=' | '-' | '_' | '?'))
        .count();
    encoded * 100 >= text.chars().count() * 97
}
