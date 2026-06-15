use leptos::{ev::MouseEvent, prelude::*};
use lkjstr_app::feed::{FeedEventReferenceKind, FeedEventReferenceUnavailable};

#[derive(Clone, Debug, Eq, PartialEq)]
struct ReferenceUnavailableAttrs {
    row_key: String,
    segment_index: String,
    event_id: String,
    relays: String,
    kind: &'static str,
    label: &'static str,
}

pub(super) fn reference_unavailable(
    reference: FeedEventReferenceUnavailable,
    open_thread: Option<Callback<String>>,
) -> impl IntoView {
    let attrs = reference_unavailable_attrs(reference);
    let Some(open_thread) = open_thread else {
        return reference_unavailable_paragraph(attrs).into_any();
    };
    let event_id = attrs.event_id.clone();
    let open = move |event: MouseEvent| {
        event.stop_propagation();
        open_thread.run(event_id.clone());
    };
    view! {
        <button
            type="button"
            data-row-key=attrs.row_key
            data-segment-index=attrs.segment_index
            data-event-id=attrs.event_id
            data-relays=attrs.relays
            data-reference-kind=attrs.kind
            on:click=open
        >
            {attrs.label}
        </button>
    }
    .into_any()
}

fn reference_unavailable_paragraph(attrs: ReferenceUnavailableAttrs) -> impl IntoView {
    view! {
        <p
            data-row-key=attrs.row_key
            data-segment-index=attrs.segment_index
            data-event-id=attrs.event_id
            data-relays=attrs.relays
            data-reference-kind=attrs.kind
        >
            {attrs.label}
        </p>
    }
}

fn reference_unavailable_attrs(
    reference: FeedEventReferenceUnavailable,
) -> ReferenceUnavailableAttrs {
    let (kind, label) = reference_kind_attrs(&reference.kind);
    ReferenceUnavailableAttrs {
        row_key: reference.row_key,
        segment_index: reference.segment_index.to_string(),
        event_id: reference.event_id,
        relays: reference.relays.join(" "),
        kind,
        label,
    }
}

fn reference_kind_attrs(kind: &FeedEventReferenceKind) -> (&'static str, &'static str) {
    match kind {
        FeedEventReferenceKind::ReplyRoot => ("reply-root", "Thread root unavailable"),
        FeedEventReferenceKind::ReplyParent => ("reply-parent", "Reply parent unavailable"),
        FeedEventReferenceKind::Quote => ("quote", "Quoted event unavailable"),
        FeedEventReferenceKind::Repost => ("repost", "Reposted event unavailable"),
        FeedEventReferenceKind::Reaction => ("reaction", "Reaction target unavailable"),
        FeedEventReferenceKind::Deletion => ("deletion", "Deleted target unavailable"),
        FeedEventReferenceKind::NostrEvent => ("nostr-event", "Referenced event unavailable"),
    }
}

#[cfg(test)]
fn reference_unavailable_element(can_open: bool) -> &'static str {
    if can_open { "button" } else { "p" }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reference_unavailable_attrs_keep_reference_identity() {
        let attrs = reference_unavailable_attrs(FeedEventReferenceUnavailable {
            row_key: "event:e:shape:s:kind:event-reference:index:1".to_owned(),
            segment_index: 1,
            event_id: "a".repeat(64),
            kind: FeedEventReferenceKind::Quote,
            relays: vec!["wss://relay.example".to_owned()],
        });

        assert_eq!(
            attrs,
            ReferenceUnavailableAttrs {
                row_key: "event:e:shape:s:kind:event-reference:index:1".to_owned(),
                segment_index: "1".to_owned(),
                event_id: "a".repeat(64),
                relays: "wss://relay.example".to_owned(),
                kind: "quote",
                label: "Quoted event unavailable",
            }
        );
    }

    #[test]
    fn reference_unavailable_action_requires_thread_opener() {
        assert_eq!(reference_unavailable_element(false), "p");
        assert_eq!(reference_unavailable_element(true), "button");
    }
}
