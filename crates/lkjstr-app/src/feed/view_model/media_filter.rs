use crate::feed_fragments::SemanticFeedEvent;
use lkjstr_protocol::{
    ContentAttachment, ContentAttachmentKind, KIND_GENERIC_REPOST, KIND_REACTION, KIND_REPOST,
    KIND_ZAP_RECEIPT,
};

#[must_use]
pub fn event_media_attachments(event: &SemanticFeedEvent) -> Vec<ContentAttachment> {
    if matches!(
        event.event_kind,
        KIND_REPOST | KIND_GENERIC_REPOST | KIND_REACTION | KIND_ZAP_RECEIPT
    ) {
        return Vec::new();
    }
    event
        .media_attachments
        .iter()
        .filter(|item| !matches!(item.kind, ContentAttachmentKind::Link))
        .cloned()
        .collect()
}
