//! NIP-10 marked threads and NIP-27 validated inline mentions.
use crate::{
    Result,
    entity::Entity,
    event::{Tag, UnsignedEvent},
    unhex,
};

/// Reference to a thread event, retaining discovery hints.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Reference {
    /// Event ID.
    pub id: String,
    /// Optional recommended relay.
    pub relay: Option<String>,
    /// Optional referenced author's key.
    pub author: Option<String>,
}
/// Reply ancestry and deprecated positional mentions.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Thread {
    /// Thread root.
    pub root: Option<Reference>,
    /// Direct parent (root for a direct reply to the root).
    pub reply: Option<Reference>,
    /// Historical positional or explicitly marked mentions.
    pub mentions: Vec<Reference>,
}
fn reference(t: &Tag) -> Option<Reference> {
    let id = t.get(1)?;
    unhex::<32>(id).ok()?;
    Some(Reference {
        id: id.clone(),
        relay: t.get(2).filter(|r| !r.is_empty()).cloned(),
        author: t.get(4).filter(|a| unhex::<32>(a).is_ok()).cloned(),
    })
}
/// Parse kind-1 ancestry. Marked tags take precedence over positional tags.
pub fn parse(event: &UnsignedEvent) -> Thread {
    if event.kind != 1 {
        return Thread::default();
    }
    let refs: Vec<_> = event
        .tags
        .iter()
        .filter(|t| t.first().is_some_and(|n| n == "e"))
        .filter_map(|t| reference(t).map(|r| (t, r)))
        .collect();
    let marked = refs
        .iter()
        .any(|(t, _)| t.get(3).is_some_and(|m| !m.is_empty()));
    let mut out = Thread::default();
    if marked {
        for (tag, r) in refs {
            match tag.get(3).map(String::as_str) {
                Some("root") => {
                    if out.root.is_none() {
                        out.root = Some(r);
                    }
                }
                Some("reply") => {
                    if out.reply.is_none() {
                        out.reply = Some(r);
                    }
                }
                Some("mention") => out.mentions.push(r),
                _ => {}
            }
        }
        if out.reply.is_none() {
            out.reply = out.root.clone();
        }
    } else {
        out.root = refs.first().map(|(_, r)| r.clone());
        out.reply = refs.last().map(|(_, r)| r.clone());
        if refs.len() > 2 {
            out.mentions = refs[1..refs.len() - 1]
                .iter()
                .map(|(_, r)| r.clone())
                .collect();
        }
    }
    out
}
/// A decoded public mention and its UTF-8 byte span in the original text.
#[derive(Clone, Debug)]
pub struct Mention {
    /// Inclusive UTF-8 byte offset.
    pub start: usize,
    /// Exclusive UTF-8 byte offset.
    pub end: usize,
    /// Valid public NIP-19 entity.
    pub entity: Entity,
}
/// Parse NIP-21 mentions without a regex. Invalid links and nsec are ignored.
pub fn mentions(content: &str) -> Vec<Mention> {
    let mut found = Vec::new();
    let bytes = content.as_bytes();
    let mut offset = 0;
    while offset + 6 <= bytes.len() {
        if bytes[offset..offset + 6].eq_ignore_ascii_case(b"nostr:") {
            let start = offset;
            let mut end = offset + 6;
            while end < bytes.len() && bytes[end].is_ascii_alphanumeric() {
                end += 1;
            }
            if end - start <= 5006
                && let Ok(entity) = Entity::from_uri(&content[start..end])
            {
                found.push(Mention { start, end, entity });
            }
            offset = end;
        } else {
            offset += 1;
        }
    }
    found
}
/// Build an explicit root/reply marker tag.
pub fn reply_tag(reference: &Reference, root: bool) -> Result<Tag> {
    unhex::<32>(&reference.id)?;
    let mut tag = vec![
        "e".into(),
        reference.id.clone(),
        reference.relay.clone().unwrap_or_default(),
        if root { "root" } else { "reply" }.into(),
    ];
    if let Some(author) = &reference.author {
        unhex::<32>(author)?;
        tag.push(author.clone());
    }
    Ok(tag)
}
