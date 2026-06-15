use crate::{
    EventReference, EventReferenceKind, EventReferenceSource, KIND_DELETION, KIND_GENERIC_REPOST,
    KIND_REACTION, KIND_REPOST, NostrEntity, NostrEvent, decode_nip19,
    event_reference_parts::{
        dedupe, last_e_tag, normalized_relays, push, push_event_tag, tag_name_is, tag_relay,
    },
    event_reference_scan::{nostr_entities, nostr_entity_spans},
    is_event_id, reply_parent, reply_root,
};

#[must_use]
pub fn event_references(event: &NostrEvent) -> Vec<EventReference> {
    let mut refs = Vec::new();
    match event.kind {
        KIND_REPOST | KIND_GENERIC_REPOST => {
            push_event_tag(
                &mut refs,
                EventReferenceKind::Repost,
                last_e_tag(event),
                EventReferenceSource::Repost,
            );
            return dedupe(refs);
        }
        KIND_REACTION => {
            push_event_tag(
                &mut refs,
                EventReferenceKind::Reaction,
                last_e_tag(event),
                EventReferenceSource::Reaction,
            );
            return dedupe(refs);
        }
        KIND_DELETION => {
            for tag in event.tags.iter().filter(|tag| tag_name_is(tag, "e")) {
                push_event_tag(
                    &mut refs,
                    EventReferenceKind::Deletion,
                    Some(tag.as_slice()),
                    EventReferenceSource::Deletion,
                );
            }
            return dedupe(refs);
        }
        _ => {}
    }
    push_marked_replies(&mut refs, event);
    push_missing_reply_fallbacks(&mut refs, event);
    for tag in event.tags.iter().filter(|tag| tag_name_is(tag, "q")) {
        push(
            &mut refs,
            EventReferenceKind::Quote,
            tag.get(1),
            EventReferenceSource::Q,
            tag_relay(tag),
        );
    }
    refs.extend(nostr_event_references(&event.content));
    dedupe(refs)
}

#[must_use]
pub fn strip_event_reference_tokens(content: &str, refs: &[EventReference]) -> String {
    if refs.is_empty() {
        return content.to_owned();
    }
    let mut output = String::new();
    let mut cursor = 0;
    let mut removed = false;
    for span in nostr_entity_spans(content) {
        let Some(id) = event_entity_id(&span.entity) else {
            continue;
        };
        if !refs.iter().any(|item| item.id == id) {
            continue;
        }
        output.push_str(&content[cursor..span.start]);
        cursor = span.end;
        removed = true;
    }
    if !removed {
        return content.to_owned();
    }
    output.push_str(&content[cursor..]);
    output.trim().to_owned()
}

fn push_marked_replies(refs: &mut Vec<EventReference>, event: &NostrEvent) {
    for tag in event.tags.iter().filter(|tag| tag_name_is(tag, "e")) {
        if tag.get(3).is_some_and(|marker| marker == "root") {
            push_event_tag(
                refs,
                EventReferenceKind::ReplyRoot,
                Some(tag.as_slice()),
                EventReferenceSource::E,
            );
        }
        if tag.get(3).is_some_and(|marker| marker == "reply") {
            push_event_tag(
                refs,
                EventReferenceKind::ReplyParent,
                Some(tag.as_slice()),
                EventReferenceSource::E,
            );
        }
    }
}

fn push_missing_reply_fallbacks(refs: &mut Vec<EventReference>, event: &NostrEvent) {
    if !refs
        .iter()
        .any(|item| item.kind == EventReferenceKind::ReplyRoot)
    {
        push(
            refs,
            EventReferenceKind::ReplyRoot,
            reply_root(event).as_ref(),
            EventReferenceSource::E,
            Vec::new(),
        );
    }
    if !refs
        .iter()
        .any(|item| item.kind == EventReferenceKind::ReplyParent)
    {
        push(
            refs,
            EventReferenceKind::ReplyParent,
            reply_parent(event).as_ref(),
            EventReferenceSource::E,
            Vec::new(),
        );
    }
}

fn nostr_event_references(content: &str) -> Vec<EventReference> {
    nostr_entities(content)
        .into_iter()
        .filter_map(|entity| match decode_nip19(&entity) {
            Some(NostrEntity::Note(id)) if is_event_id(&id) => {
                Some(content_ref(id, Vec::new(), None))
            }
            Some(NostrEntity::Nevent(pointer)) if is_event_id(&pointer.id) => Some(content_ref(
                pointer.id,
                normalized_relays(pointer.relays.unwrap_or_default()),
                pointer.author,
            )),
            _ => None,
        })
        .collect()
}

fn event_entity_id(entity: &str) -> Option<String> {
    match decode_nip19(entity) {
        Some(NostrEntity::Note(id)) if is_event_id(&id) => Some(id),
        Some(NostrEntity::Nevent(pointer)) if is_event_id(&pointer.id) => Some(pointer.id),
        _ => None,
    }
}

fn content_ref(id: String, relays: Vec<String>, author_pubkey: Option<String>) -> EventReference {
    EventReference {
        kind: EventReferenceKind::NostrEvent,
        id,
        relays,
        author_pubkey,
        marker: None,
        source: EventReferenceSource::Content,
    }
}
