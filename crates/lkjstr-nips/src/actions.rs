//! NIP-25 reactions and NIP-18 reposts. Embedded reposts are authenticated.
use crate::{
    Error, Result,
    address::Coordinate,
    event::{Event, UnsignedEvent, unique, values},
    relay::relay_url,
    unhex,
};

/// Reaction interpretation, without conflating emoji with likes.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ReactionValue {
    /// `+` or empty content.
    Like,
    /// `-`.
    Dislike,
    /// Any other user-supplied reaction text (including emoji/shortcodes).
    Text(String),
}
/// Parsed native-event reaction.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Reaction {
    /// Last e-tag is the target, even if ancestry tags precede it.
    pub event: String,
    /// Last p-tag is the target author.
    pub author: Option<String>,
    /// Optional addressable target.
    pub address: Option<Coordinate>,
    /// Reaction content semantics.
    pub value: ReactionValue,
}
/// Interpret an ingress-verified kind-7 event.
pub fn reaction(event: &UnsignedEvent) -> Result<Reaction> {
    if event.kind != 7 {
        return Err(Error::Invalid);
    }
    let target = values(&event.tags, "e").last().ok_or(Error::Invalid)?;
    unhex::<32>(target)?;
    let author = values(&event.tags, "p").last();
    if let Some(author) = author {
        unhex::<32>(author)?;
    }
    let address = values(&event.tags, "a")
        .last()
        .map(Coordinate::parse)
        .transpose()?;
    let value = match event.content.as_str() {
        "" | "+" => ReactionValue::Like,
        "-" => ReactionValue::Dislike,
        text => ReactionValue::Text(text.into()),
    };
    Ok(Reaction {
        event: target.into(),
        author: author.map(str::to_owned),
        address,
        value,
    })
}
/// Construct a native reaction payload with target hints and optional address.
pub fn reaction_event(
    author: String,
    target: &Event,
    content: &str,
    relay: &str,
    now: u64,
) -> Result<UnsignedEvent> {
    target.verify()?;
    let relay = relay_url(relay)?;
    let mut tags = vec![
        vec![
            "e".into(),
            target.id.clone(),
            relay.clone(),
            target.data.pubkey.clone(),
        ],
        vec!["p".into(), target.data.pubkey.clone(), relay],
        vec!["k".into(), target.data.kind.to_string()],
    ];
    if (30000..40000).contains(&target.data.kind) {
        tags.push(vec!["a".into(), Coordinate::of(&target.data)?.to_string()]);
    }
    let event = UnsignedEvent::new(author, now, 7, tags, content);
    event.validate()?;
    Ok(event)
}
/// Authenticated repost data; a missing embedded target requires relay lookup.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Repost {
    /// Declared target event ID.
    pub target: String,
    /// Required discovery relay hint.
    pub relay: String,
    /// Verified embedded event, if present.
    pub embedded: Option<Event>,
}
/// Validate the wrapper and embedded event, including kind, ID, author, and
/// coordinate consistency. No recursive repost expansion occurs.
pub fn repost(event: &Event) -> Result<Repost> {
    event.verify()?;
    if !matches!(event.data.kind, 6 | 16) {
        return Err(Error::Invalid);
    }
    let target = unique(&event.data.tags, "e")?.ok_or(Error::Invalid)?;
    unhex::<32>(target)?;
    let e = event
        .data
        .tags
        .iter()
        .find(|t| t.first().is_some_and(|n| n == "e"))
        .ok_or(Error::Invalid)?;
    let relay = relay_url(e.get(2).ok_or(Error::Invalid)?)?;
    let author = unique(&event.data.tags, "p")?;
    if let Some(author) = author {
        unhex::<32>(author)?;
    }
    let kind = unique(&event.data.tags, "k")?
        .map(|k| k.parse::<u16>().map_err(|_| Error::Invalid))
        .transpose()?;
    let address = unique(&event.data.tags, "a")?
        .map(Coordinate::parse)
        .transpose()?;
    let embedded = if event.data.content.is_empty() {
        None
    } else {
        let inner = Event::parse(&event.data.content, crate::nip44::MAX_PLAINTEXT)?;
        if inner.id != target
            || author.is_some_and(|a| a != inner.data.pubkey)
            || (event.data.kind == 6 && inner.data.kind != 1)
            || (event.data.kind == 16 && inner.data.kind == 1)
            || kind.is_some_and(|k| k != inner.data.kind)
        {
            return Err(Error::Identity);
        }
        if let Some(address) = address
            && address != Coordinate::of(&inner.data)?
        {
            return Err(Error::Identity);
        }
        Some(inner)
    };
    Ok(Repost {
        target: target.into(),
        relay,
        embedded,
    })
}
/// Construct a repost with verified embedded JSON. Protected events omit content.
pub fn repost_event(
    author: String,
    target: &Event,
    relay: &str,
    now: u64,
) -> Result<UnsignedEvent> {
    target.verify()?;
    let relay = relay_url(relay)?;
    let mut tags = vec![
        vec!["e".into(), target.id.clone(), relay],
        vec!["p".into(), target.data.pubkey.clone()],
        vec!["k".into(), target.data.kind.to_string()],
    ];
    if let Ok(address) = Coordinate::of(&target.data) {
        tags.push(vec!["a".into(), address.to_string()]);
    }
    let protected = target
        .data
        .tags
        .iter()
        .any(|t| t.first().is_some_and(|n| n == "-"));
    let content = if protected {
        String::new()
    } else {
        target.to_json()?
    };
    let event = UnsignedEvent::new(
        author,
        now,
        if target.data.kind == 1 { 6 } else { 16 },
        tags,
        content,
    );
    event.validate()?;
    Ok(event)
}
