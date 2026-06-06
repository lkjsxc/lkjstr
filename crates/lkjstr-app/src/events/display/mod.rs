#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EventDisplayContext {
    Timeline,
    Profile,
    Thread,
    Search,
    Notification,
    Quote,
    RepostTarget,
    CustomRequest,
    AuthorContext,
    UserTimeline,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct EventDisplayCapabilities {
    pub content: bool,
    pub media: bool,
    pub references: bool,
    pub custom_emoji: bool,
    pub sensitive_reveal: bool,
    pub actions: bool,
}

impl EventDisplayCapabilities {
    #[must_use]
    pub const fn shared_event() -> Self {
        Self {
            content: true,
            media: true,
            references: true,
            custom_emoji: true,
            sensitive_reveal: true,
            actions: true,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct EventDisplayChromePolicy {
    pub show_author: bool,
    pub show_provenance: bool,
    pub show_actions: bool,
    pub embedded: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventDisplayInput {
    pub event_id: Option<String>,
    pub event_kind: Option<u64>,
    pub content_shape_hash: Option<String>,
    pub context: EventDisplayContext,
    pub target_available: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EventDisplayRenderer {
    SharedEvent,
    CompactUnavailable,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventDisplayPlan {
    pub renderer: EventDisplayRenderer,
    pub context: EventDisplayContext,
    pub capabilities: EventDisplayCapabilities,
    pub chrome: EventDisplayChromePolicy,
    pub geometry_context: &'static str,
}

#[must_use]
pub fn plan_event_display(input: &EventDisplayInput) -> EventDisplayPlan {
    if !input.target_available || input.event_id.is_none() {
        return EventDisplayPlan {
            renderer: EventDisplayRenderer::CompactUnavailable,
            context: input.context,
            capabilities: EventDisplayCapabilities {
                actions: false,
                ..EventDisplayCapabilities::shared_event()
            },
            chrome: chrome_for(input.context, false),
            geometry_context: "unavailable-event",
        };
    }
    EventDisplayPlan {
        renderer: EventDisplayRenderer::SharedEvent,
        context: input.context,
        capabilities: EventDisplayCapabilities::shared_event(),
        chrome: chrome_for(input.context, true),
        geometry_context: geometry_context(input.context),
    }
}

#[must_use]
pub fn plan_repost_target_display(
    event_id: Option<String>,
    content_shape_hash: Option<String>,
    target_available: bool,
) -> EventDisplayPlan {
    plan_event_display(&EventDisplayInput {
        event_id,
        event_kind: Some(1),
        content_shape_hash,
        context: EventDisplayContext::RepostTarget,
        target_available,
    })
}

fn chrome_for(context: EventDisplayContext, available: bool) -> EventDisplayChromePolicy {
    let embedded = matches!(
        context,
        EventDisplayContext::Quote | EventDisplayContext::RepostTarget
    );
    EventDisplayChromePolicy {
        show_author: available,
        show_provenance: !embedded && available,
        show_actions: available && !embedded,
        embedded,
    }
}

fn geometry_context(context: EventDisplayContext) -> &'static str {
    match context {
        EventDisplayContext::RepostTarget => "shared-event:repost-target",
        EventDisplayContext::Quote => "shared-event:quote",
        EventDisplayContext::Notification => "shared-event:notification",
        _ => "shared-event",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normal_event_and_repost_target_use_shared_renderer() {
        let normal = plan_event_display(&EventDisplayInput {
            event_id: Some("a".to_owned()),
            event_kind: Some(1),
            content_shape_hash: Some("shape".to_owned()),
            context: EventDisplayContext::Timeline,
            target_available: true,
        });
        let repost =
            plan_repost_target_display(Some("a".to_owned()), Some("shape".to_owned()), true);

        assert_eq!(normal.renderer, EventDisplayRenderer::SharedEvent);
        assert_eq!(repost.renderer, EventDisplayRenderer::SharedEvent);
        assert!(repost.capabilities.media);
        assert!(repost.capabilities.references);
        assert!(!repost.chrome.show_actions);
    }

    #[test]
    fn missing_repost_target_is_compact_unavailable() {
        let plan = plan_repost_target_display(None, None, false);

        assert_eq!(plan.renderer, EventDisplayRenderer::CompactUnavailable);
        assert_eq!(plan.geometry_context, "unavailable-event");
        assert!(!plan.chrome.show_actions);
    }
}
