use lkjstr_relays::DemandPhase;

use crate::{
    EventDisplayContext, FeedFooterState, FeedStateRow, FeedViewModelInput,
    ThreadRepliesQueryInput, ThreadRootLookupInput, build_feed_view_model, diagnostic_state_row,
    footer_row, footer_row_from_window, thread_replies_query_input, thread_root_lookup_input,
    unavailable_state_row,
};

use super::{ThreadFeedSourceState, ThreadFeedStatus, ThreadFeedView, ThreadFeedViewInput};
use crate::thread_feed::context_rows::thread_context_rows;

#[must_use]
pub fn build_thread_feed_view(input: ThreadFeedViewInput) -> ThreadFeedView {
    let feed_id = thread_feed_id(&input.owner);
    let context_rows = thread_context_rows(&input);
    let mut state_rows = context_rows.rows;
    state_rows.extend(diagnostic_rows(&input));
    let (status, root_lookup, replies_query, footer_state) =
        thread_state(&input, &feed_id, &mut state_rows);
    let footer = footer_state.unwrap_or_else(|| footer_row_from_window(&feed_id, &input.window));
    let view_model = build_feed_view_model(FeedViewModelInput {
        feed_id,
        display_context: EventDisplayContext::Thread,
        window: context_rows.window,
        width_px: input.width_px,
        font_scale: input.font_scale,
        geometry_models: input.geometry_models,
        fragment_config: input.fragment_config,
        state_rows,
        footer,
    });
    ThreadFeedView {
        status,
        root_lookup,
        replies_query,
        view_model,
    }
}

#[must_use]
pub fn thread_feed_id(owner: &str) -> String {
    format!("thread:{owner}")
}

fn thread_state(
    input: &ThreadFeedViewInput,
    feed_id: &str,
    state_rows: &mut Vec<FeedStateRow>,
) -> ThreadStateResult {
    let Some(event_id) = input.event_id.clone() else {
        state_rows.push(unavailable_state_row(
            "missing-thread-event",
            "thread",
            "Thread needs an event id from the opened timeline row.",
            false,
        ));
        return blocked(
            ThreadFeedStatus::MissingEventId,
            feed_id,
            FeedFooterState::ConfigurationUnavailable,
        );
    };
    if input.selected_relays.is_empty() && input.author_routes.is_empty() {
        state_rows.push(unavailable_state_row(
            "no-enabled-relay",
            &event_id,
            "Thread needs at least one enabled read relay or author route.",
            true,
        ));
        return blocked(
            ThreadFeedStatus::NoEnabledRelay,
            feed_id,
            FeedFooterState::ConfigurationUnavailable,
        );
    }
    ready_state(input, event_id, feed_id, state_rows)
}

type ThreadStateResult = (
    ThreadFeedStatus,
    Option<crate::QueryDemandInput>,
    Option<crate::QueryDemandInput>,
    Option<crate::FeedFooterRow>,
);

fn ready_state(
    input: &ThreadFeedViewInput,
    event_id: String,
    feed_id: &str,
    state_rows: &mut Vec<FeedStateRow>,
) -> ThreadStateResult {
    let root_event_id = input
        .root_event_id
        .clone()
        .unwrap_or_else(|| event_id.clone());
    let root_lookup = Some(thread_root_lookup_input(ThreadRootLookupInput {
        owner: input.owner.clone(),
        visibility: input.visibility,
        selected_relays: input.selected_relays.clone(),
        disabled_relays: input.disabled_relays.clone(),
        event_id: event_id.clone(),
        root_author: input.root_author.clone(),
        author_routes: input.author_routes.clone(),
        now_sec: input.now_sec,
    }));
    let replies_query = Some(thread_replies_query_input(ThreadRepliesQueryInput {
        owner: input.owner.clone(),
        visibility: input.visibility,
        selected_relays: input.selected_relays.clone(),
        disabled_relays: input.disabled_relays.clone(),
        root_event_id,
        focus_event_id: event_id,
        root_author: input.root_author.clone(),
        author_routes: input.author_routes.clone(),
        phase: DemandPhase::Bootstrap,
        since: input.since,
        until: input.until,
        now_sec: input.now_sec,
        page_size: input.page_size,
    }));
    source_result(input, feed_id, state_rows, root_lookup, replies_query)
}

fn source_result(
    input: &ThreadFeedViewInput,
    feed_id: &str,
    state_rows: &mut Vec<FeedStateRow>,
    root_lookup: Option<crate::QueryDemandInput>,
    replies_query: Option<crate::QueryDemandInput>,
) -> ThreadStateResult {
    match &input.source_state {
        ThreadFeedSourceState::CacheComplete => {
            let state = if input.window.visible_events().is_empty() {
                FeedFooterState::TerminalEmpty
            } else {
                FeedFooterState::CacheHit
            };
            (
                ThreadFeedStatus::Ready,
                root_lookup,
                replies_query,
                Some(footer_row(feed_id, state)),
            )
        }
        ThreadFeedSourceState::Partial {
            reason,
            retry_available,
        } => {
            state_rows.push(unavailable_state_row(
                "partial-thread-coverage",
                "thread",
                reason,
                *retry_available,
            ));
            let footer_state =
                if input.window.has_older && !input.window.visible_events().is_empty() {
                    FeedFooterState::OlderLoadReady
                } else {
                    FeedFooterState::Partial
                };
            (
                ThreadFeedStatus::Partial,
                root_lookup,
                replies_query,
                Some(footer_row(feed_id, footer_state)),
            )
        }
        ThreadFeedSourceState::Pending => {
            (ThreadFeedStatus::Loading, root_lookup, replies_query, None)
        }
        ThreadFeedSourceState::RelayProgressive => {
            (ThreadFeedStatus::Ready, root_lookup, replies_query, None)
        }
    }
}

fn diagnostic_rows(input: &ThreadFeedViewInput) -> Vec<FeedStateRow> {
    input
        .diagnostics
        .iter()
        .map(|item| diagnostic_state_row(&item.scope, &item.id, item.severity, &item.message))
        .collect()
}

fn blocked(
    status: ThreadFeedStatus,
    feed_id: &str,
    footer_state: FeedFooterState,
) -> ThreadStateResult {
    (status, None, None, Some(footer_row(feed_id, footer_state)))
}
