use leptos::prelude::*;
use lkjstr_app::feed::{FeedEventRepostTarget, FeedEventRepostTargetShell};

use super::feed_event_content::event_content_with_openers;

#[derive(Clone, Debug, Eq, PartialEq)]
struct RepostTargetAttrs {
    row_key: String,
    event_id: String,
    label: String,
    geometry_context: &'static str,
    estimated_height: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct RepostTargetShellAttrs {
    row_key: String,
    event_id: String,
    reserved_height: String,
    style: String,
}

pub(super) fn repost_target(
    target: FeedEventRepostTarget,
    open_profile: Option<Callback<String>>,
    open_thread: Option<Callback<String>>,
) -> AnyView {
    let attrs = repost_target_attrs(&target);
    let content = event_content_with_openers(target.content, open_profile, open_thread);
    view! {
        <aside
            class="event-embed"
            data-kind="nested-repost"
            data-event-display-context=attrs.geometry_context
            data-row-key=attrs.row_key
            data-event-id=attrs.event_id
            data-estimated-height=attrs.estimated_height
        >
            <strong class="sr-only">"Reposted event"</strong>
            <small>{attrs.label}</small>
            {content}
        </aside>
    }
    .into_any()
}

pub(super) fn repost_target_shell(shell: FeedEventRepostTargetShell) -> AnyView {
    let attrs = repost_target_shell_attrs(&shell);
    view! {
        <aside
            class="event-embed repost-target-shell"
            data-kind="nested-repost-shell"
            data-row-key=attrs.row_key
            data-event-id=attrs.event_id
            data-reserved-height=attrs.reserved_height
            style=attrs.style
        >
            <small>"Reposted event"</small>
        </aside>
    }
    .into_any()
}

fn repost_target_attrs(target: &FeedEventRepostTarget) -> RepostTargetAttrs {
    RepostTargetAttrs {
        row_key: target.row_key.clone(),
        event_id: target.event_id.clone(),
        label: format!(
            "{} created {}",
            compact_pubkey(&target.author_pubkey),
            target.created_at
        ),
        geometry_context: target.display.geometry_context,
        estimated_height: target.geometry_estimate.estimated_height_px.to_string(),
    }
}

fn repost_target_shell_attrs(shell: &FeedEventRepostTargetShell) -> RepostTargetShellAttrs {
    let reserved_height = shell.reserved_height_px.to_string();
    RepostTargetShellAttrs {
        row_key: shell.row_key.clone(),
        event_id: shell.event_id.clone(),
        style: format!("min-height:{reserved_height}px;"),
        reserved_height,
    }
}

fn compact_pubkey(pubkey: &str) -> String {
    if pubkey.len() <= 16 {
        return pubkey.to_owned();
    }
    format!("{}...{}", &pubkey[..8], &pubkey[pubkey.len() - 8..])
}

#[cfg(test)]
#[path = "feed_event_repost_target_tests.rs"]
mod tests;
