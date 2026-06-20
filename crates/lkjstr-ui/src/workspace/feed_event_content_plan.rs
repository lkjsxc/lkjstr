use lkjstr_app::feed::{
    FeedEventContentRow, FeedEventCustomEmoji, FeedEventLink, FeedEventMediaAttachment,
    FeedEventProfileMention, FeedEventReferenceUnavailable, FeedEventRepostTarget,
    FeedEventRepostTargetShell, FeedEventUnavailablePreview,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) struct FeedEventContentRowOpeners {
    pub(super) profile: bool,
    pub(super) thread: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub(super) enum FeedEventContentRowRenderPlan {
    Text(String),
    Link(FeedEventLink),
    ProfileMention(FeedEventProfileMention),
    CustomEmoji(FeedEventCustomEmoji),
    MediaAttachment(FeedEventMediaAttachment),
    RepostTarget(FeedEventRepostTarget),
    RepostTargetShell(FeedEventRepostTargetShell),
    MediaPreviewUnavailable(FeedEventUnavailablePreview),
    ReferenceUnavailable(FeedEventReferenceUnavailable),
    ReferencePreviewUnavailable(FeedEventUnavailablePreview),
}

impl FeedEventContentRowOpeners {
    const NONE: Self = Self {
        profile: false,
        thread: false,
    };
    const PROFILE: Self = Self {
        profile: true,
        thread: false,
    };
    const THREAD: Self = Self {
        profile: false,
        thread: true,
    };
    const PROFILE_AND_THREAD: Self = Self {
        profile: true,
        thread: true,
    };
}

impl FeedEventContentRowRenderPlan {
    pub(super) const fn openers(&self) -> FeedEventContentRowOpeners {
        match self {
            Self::ProfileMention(_) => FeedEventContentRowOpeners::PROFILE,
            Self::RepostTarget(_) => FeedEventContentRowOpeners::PROFILE_AND_THREAD,
            Self::ReferenceUnavailable(_) => FeedEventContentRowOpeners::THREAD,
            Self::Text(_)
            | Self::Link(_)
            | Self::CustomEmoji(_)
            | Self::MediaAttachment(_)
            | Self::RepostTargetShell(_)
            | Self::MediaPreviewUnavailable(_)
            | Self::ReferencePreviewUnavailable(_) => FeedEventContentRowOpeners::NONE,
        }
    }
}

pub(super) fn content_row_render_plan(row: FeedEventContentRow) -> FeedEventContentRowRenderPlan {
    match row {
        FeedEventContentRow::Text(text) => FeedEventContentRowRenderPlan::Text(text),
        FeedEventContentRow::Link(link) => FeedEventContentRowRenderPlan::Link(link),
        FeedEventContentRow::ProfileMention(mention) => {
            FeedEventContentRowRenderPlan::ProfileMention(mention)
        }
        FeedEventContentRow::CustomEmoji(emoji) => {
            FeedEventContentRowRenderPlan::CustomEmoji(emoji)
        }
        FeedEventContentRow::MediaAttachment(media) => {
            FeedEventContentRowRenderPlan::MediaAttachment(media)
        }
        FeedEventContentRow::RepostTarget(target) => {
            FeedEventContentRowRenderPlan::RepostTarget(target)
        }
        FeedEventContentRow::RepostTargetShell(shell) => {
            FeedEventContentRowRenderPlan::RepostTargetShell(shell)
        }
        FeedEventContentRow::MediaPreviewUnavailable(preview) => {
            FeedEventContentRowRenderPlan::MediaPreviewUnavailable(preview)
        }
        FeedEventContentRow::ReferenceUnavailable(reference) => {
            FeedEventContentRowRenderPlan::ReferenceUnavailable(reference)
        }
        FeedEventContentRow::ReferencePreviewUnavailable(preview) => {
            FeedEventContentRowRenderPlan::ReferencePreviewUnavailable(preview)
        }
    }
}

#[cfg(test)]
#[path = "feed_event_content_plan_tests.rs"]
mod tests;
