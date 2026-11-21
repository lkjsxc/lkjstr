//! Validate UI UTF-16 ranges and expand only unchanged selected mentions.
use super::actions::Mention;
fn byte_at(text: &str, offset: usize) -> Option<usize> {
    let mut utf16 = 0;
    for (byte, ch) in text.char_indices() {
        if utf16 == offset {
            return Some(byte);
        }
        utf16 += ch.len_utf16();
    }
    (utf16 == offset).then_some(text.len())
}
pub(super) fn expand(text: &str, mentions: Vec<Mention>) -> String {
    let mut replacements = mentions
        .into_iter()
        .take(128)
        .filter_map(|m| {
            let (start, end) = (byte_at(text, m.start)?, byte_at(text, m.end)?);
            if start >= end || text.get(start..end)? != m.label || !m.label.starts_with('@') {
                return None;
            }
            let npub = lkjstr_protocol::encode_npub(&m.pubkey).ok()?;
            Some((start, end, format!("nostr:{npub}")))
        })
        .collect::<Vec<_>>();
    replacements.extend(lkjstr_protocol::canonical_profile_replacements(text));
    replacements.sort_by_key(|r| (r.0, r.1));
    let mut out = String::new();
    let mut at = 0;
    for (start, end, value) in replacements {
        if start < at {
            continue;
        }
        out.push_str(&text[at..start]);
        out.push_str(&value);
        at = end;
    }
    out.push_str(&text[at..]);
    out
}
