use crate::{EventReference, EventReferenceKind, EventReferenceSource, NostrEvent, is_event_id};

pub(crate) fn push_event_tag(
    refs: &mut Vec<EventReference>,
    kind: EventReferenceKind,
    tag: Option<&[String]>,
    source: EventReferenceSource,
) {
    let Some(tag) = tag else { return };
    let Some(id) = tag.get(1).filter(|id| is_event_id(id)) else {
        return;
    };
    refs.push(EventReference {
        kind,
        id: id.clone(),
        relays: tag_relay(tag),
        author_pubkey: tag.get(4).filter(|value| !value.is_empty()).cloned(),
        marker: tag.get(3).filter(|value| !value.is_empty()).cloned(),
        source,
    });
}

pub(crate) fn push(
    refs: &mut Vec<EventReference>,
    kind: EventReferenceKind,
    id: Option<&String>,
    source: EventReferenceSource,
    relays: Vec<String>,
) {
    if let Some(id) = id.filter(|id| is_event_id(id)) {
        refs.push(EventReference {
            kind,
            id: id.clone(),
            relays,
            author_pubkey: None,
            marker: None,
            source,
        });
    }
}

pub(crate) fn dedupe(refs: Vec<EventReference>) -> Vec<EventReference> {
    let mut deduped = Vec::<EventReference>::new();
    for item in refs {
        if let Some(existing) = deduped.iter_mut().find(|existing| existing.id == item.id) {
            merge_ref(existing, item);
        } else {
            deduped.push(item);
        }
    }
    deduped
}

pub(crate) fn last_e_tag(event: &NostrEvent) -> Option<&[String]> {
    event
        .tags
        .iter()
        .rfind(|tag| tag_name_is(tag, "e"))
        .map(Vec::as_slice)
}

pub(crate) fn tag_name_is(tag: &[String], name: &str) -> bool {
    tag.first().is_some_and(|item| item == name)
}

pub(crate) fn tag_relay(tag: &[String]) -> Vec<String> {
    tag.get(2)
        .filter(|relay| !relay.is_empty())
        .cloned()
        .into_iter()
        .collect()
}

fn merge_ref(existing: &mut EventReference, item: EventReference) {
    for relay in item.relays {
        if !existing.relays.contains(&relay) {
            existing.relays.push(relay);
        }
    }
    existing.author_pubkey = existing.author_pubkey.take().or(item.author_pubkey);
    existing.marker = existing.marker.take().or(item.marker);
}
