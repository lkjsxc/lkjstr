//! imeta can carry a media MIME type even when the URL has no file extension.
use crate::content::Segment;
use lkjstr_protocol::{ContentAttachmentKind, NostrEvent, embedded_media_attachments};
pub(super) fn attachments(event: &NostrEvent, parts: &mut Vec<Segment>) {
    for media in embedded_media_attachments(event) {
        let url = media.url;
        let part = match media.kind {
            ContentAttachmentKind::Image => Segment::Image(url.clone()),
            ContentAttachmentKind::Video => Segment::Video(url.clone()),
            ContentAttachmentKind::Audio => Segment::Audio(url.clone()),
            _ => continue,
        };
        if parts
            .iter()
            .any(|p| matches!(p,Segment::Image(s)|Segment::Video(s)|Segment::Audio(s) if *s==url))
        {
            continue;
        }
        if let Some(index) = parts
            .iter()
            .position(|p| matches!(p,Segment::Link(s) if *s==url))
        {
            parts[index] = part;
        } else {
            parts.push(part);
        }
    }
}
