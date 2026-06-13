use lkjstr_app::{
    NotificationItemInput, NotificationsFeedDiagnosticInput, NotificationsFeedSourceState,
    older_notification_cursor,
};
use lkjstr_protocol::NostrEvent;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) enum NotificationsRelayReadPhase {
    Initial,
    Older { cursor_created_at: u64 },
}

#[derive(Clone)]
pub(crate) struct NotificationsRelayReadInput {
    pub(crate) owner: String,
    pub(crate) active_pubkey: String,
    pub(crate) selected_relays: Vec<String>,
    pub(crate) cache_window: lkjstr_app::FeedWindowState,
    pub(crate) notification_rows: Vec<NotificationItemInput>,
    pub(crate) diagnostics: Vec<NotificationsFeedDiagnosticInput>,
    pub(crate) now_sec: u64,
    pub(crate) since: u64,
    pub(crate) until: u64,
    pub(crate) phase: NotificationsRelayReadPhase,
}

pub(crate) struct NotificationsRelayInputSeed<'a> {
    pub(crate) owner: &'a str,
    pub(crate) active_pubkey: &'a Option<String>,
    pub(crate) source_state: &'a NotificationsFeedSourceState,
    pub(crate) selected_relays: &'a [String],
    pub(crate) window: &'a lkjstr_app::FeedWindowState,
    pub(crate) notification_rows: &'a [NotificationItemInput],
    pub(crate) diagnostics: &'a [NotificationsFeedDiagnosticInput],
    pub(crate) now_sec: u64,
    pub(crate) since: u64,
    pub(crate) until: u64,
}

pub(crate) fn notifications_relay_input(
    seed: NotificationsRelayInputSeed<'_>,
) -> Option<NotificationsRelayReadInput> {
    let base = notifications_initial_relay_input(&seed)?;
    if seed.source_state == &NotificationsFeedSourceState::CacheComplete {
        return cache_complete_older_read(base, seed);
    }
    Some(base)
}

pub(crate) fn notifications_initial_relay_input(
    seed: &NotificationsRelayInputSeed<'_>,
) -> Option<NotificationsRelayReadInput> {
    if seed.selected_relays.is_empty() {
        return None;
    }
    Some(NotificationsRelayReadInput {
        owner: seed.owner.to_owned(),
        active_pubkey: seed.active_pubkey.clone()?,
        selected_relays: seed.selected_relays.to_vec(),
        cache_window: seed.window.clone(),
        notification_rows: seed.notification_rows.to_vec(),
        diagnostics: seed.diagnostics.to_vec(),
        now_sec: seed.now_sec,
        since: seed.since,
        until: seed.until,
        phase: NotificationsRelayReadPhase::Initial,
    })
}

fn cache_complete_older_read(
    base: NotificationsRelayReadInput,
    seed: NotificationsRelayInputSeed<'_>,
) -> Option<NotificationsRelayReadInput> {
    if !seed.window.visible_events().is_empty() {
        return None;
    }
    Some(notifications_older_relay_input(
        &base,
        older_notification_cursor(seed.since),
        seed.since,
    ))
}

pub(crate) fn notifications_older_relay_input(
    base: &NotificationsRelayReadInput,
    cursor: lkjstr_app::NotificationRelayCursor,
    cursor_created_at: u64,
) -> NotificationsRelayReadInput {
    NotificationsRelayReadInput {
        since: cursor.since,
        until: cursor.until,
        phase: NotificationsRelayReadPhase::Older { cursor_created_at },
        ..base.clone()
    }
}

pub(crate) fn notifications_older_relay_input_from_state(
    input: &NotificationsRelayReadInput,
) -> Option<NotificationsRelayReadInput> {
    let cursor_created_at = notifications_older_cursor_created_at(input)?;
    Some(notifications_older_relay_input(
        input,
        older_notification_cursor(cursor_created_at),
        cursor_created_at,
    ))
}

pub(crate) fn notifications_older_cursor_created_at(
    input: &NotificationsRelayReadInput,
) -> Option<u64> {
    match input.phase {
        NotificationsRelayReadPhase::Older { cursor_created_at } => Some(cursor_created_at),
        NotificationsRelayReadPhase::Initial => input
            .cache_window
            .oldest_cursor
            .as_ref()
            .map(|cursor| cursor.created_at)
            .or(Some(input.since)),
    }
}

pub(crate) fn notification_event_matches_read(
    input: &NotificationsRelayReadInput,
    event: &NostrEvent,
) -> bool {
    event.created_at >= input.since
        && event.created_at <= input.until
        && event.tags.iter().any(|tag| {
            matches!(
                (tag.first().map(String::as_str), tag.get(1)),
                (Some("p"), Some(pubkey)) if pubkey == &input.active_pubkey
            )
        })
}
