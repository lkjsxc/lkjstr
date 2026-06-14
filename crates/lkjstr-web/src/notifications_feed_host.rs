use lkjstr_app::{
    FeedFragmentConfig, NotificationsFeedSourceState, NotificationsFeedView,
    NotificationsFeedViewInput, build_notifications_feed_view, empty_feed_window,
    initial_notification_cursor,
};
use lkjstr_relays::DemandVisibility;
use lkjstr_storage::StorageOutcome;
use lkjstr_ui::NotificationsFeedProvider;

use crate::{
    host_status::browser_now_ms,
    notifications_feed_cache::{CachedNotifications, cached_notifications},
    notifications_feed_coverage::{NotificationsCoverageInput, load_notifications_source_state},
    notifications_feed_geometry::notifications_feed_geometry_models,
    notifications_feed_host_commands::{
        complete_read_output, release_owner as release_notifications_owner, start_older_request,
    },
    notifications_feed_host_diagnostics::diagnostics,
    notifications_feed_host_storage::{active_account, selected_relays},
    notifications_feed_relay::start_notifications_relay_read,
    notifications_feed_relay_input::{
        NotificationsRelayInputSeed, NotificationsRelayReadInput, notifications_relay_input,
    },
    notifications_feed_relay_state::NotificationsRelayState,
    relay_read_handle::RelayReadSlot,
};

pub(crate) const PAGE_SIZE: u64 = 30;
pub(crate) const WINDOW_MAX: usize = 180;
const VIEW_WIDTH_PX: u16 = 680;
const VIEW_FONT_SCALE: f32 = 1.0;

#[derive(Clone)]
pub(crate) struct NotificationsFeedHost {
    pub(crate) db_name: String,
    pub(crate) worker_url: String,
}

pub fn notifications_feed_provider_with_worker_url(
    db_name: String,
    worker_url: String,
) -> NotificationsFeedProvider {
    let host = NotificationsFeedHost {
        db_name,
        worker_url,
    };
    let relay_state = NotificationsRelayState::default();
    let read_state = relay_state.clone();
    NotificationsFeedProvider::with_older(
        move |request| {
            let host = host.clone();
            let release_owner = request.owner.clone();
            let release_state = read_state.clone();
            let relay_slot = RelayReadSlot::default();
            let release_slot = relay_slot.clone();
            request
                .lease()
                .on_release(release_notifications_owner(
                    release_state,
                    release_owner,
                    release_slot,
                ));
            let state = read_state.clone();
            wasm_bindgen_futures::spawn_local(async move {
                let owner = request.owner.clone();
                if request.is_released() {
                    return;
                }
                let load = notifications_feed_model(&host, &owner).await;
                if request.is_released() {
                    return;
                }
                if let Some(base) = load.base.clone() {
                    state.remember(base);
                } else {
                    state.forget(&owner);
                }
                request.complete(load.model);
                if let Some(relay) = load.relay
                    && !request.is_released()
                    && let Some(handle) = start_notifications_relay_read(relay, move |output| {
                        complete_read_output(&state, &request, output);
                    })
                {
                    relay_slot.replace(handle);
                }
            });
        },
        move |request| {
            start_older_request(relay_state.clone(), request);
        },
    )
}

struct NotificationsFeedLoad {
    model: NotificationsFeedView,
    base: Option<NotificationsRelayReadInput>,
    relay: Option<NotificationsRelayReadInput>,
}

async fn notifications_feed_model(
    host: &NotificationsFeedHost,
    owner: &str,
) -> NotificationsFeedLoad {
    let now_sec = browser_now_ms() / 1_000;
    let cursor = initial_notification_cursor(now_sec);
    let (account, account_diagnostic) = active_account(host).await;
    let relays = selected_relays(host).await;
    let active_pubkey = account.as_ref().map(|item| item.pubkey.clone());
    let mut diagnostics = diagnostics(account_diagnostic, &relays);
    let selected_relays = match relays {
        StorageOutcome::Ok(relays) => relays,
        _ => Vec::new(),
    };
    let cached = match active_pubkey.as_deref() {
        Some(pubkey) if !selected_relays.is_empty() => {
            cached_notifications(host, pubkey, selected_relays.clone()).await
        }
        _ => CachedNotifications::default(),
    };
    let (notification_rows, cached_diagnostics, window) =
        cached.into_parts(empty_feed_window(1, WINDOW_MAX));
    diagnostics.extend(cached_diagnostics);
    let source_state = match active_pubkey.as_deref() {
        Some(pubkey) if !selected_relays.is_empty() => {
            load_notifications_source_state(
                &host.db_name,
                &host.worker_url,
                NotificationsCoverageInput {
                    owner,
                    active_pubkey: pubkey,
                    selected_relays: &selected_relays,
                    since: cursor.since,
                    until: cursor.until,
                    page_size: PAGE_SIZE,
                },
            )
            .await
        }
        _ => NotificationsFeedSourceState::Pending,
    };
    let geometry_models = notifications_feed_geometry_models(
        host,
        &window,
        &mut diagnostics,
        VIEW_WIDTH_PX,
        VIEW_FONT_SCALE,
    )
    .await;
    let relay = notifications_relay_input(NotificationsRelayInputSeed {
        owner,
        active_pubkey: &active_pubkey,
        source_state: &source_state,
        selected_relays: &selected_relays,
        window: &window,
        notification_rows: &notification_rows,
        diagnostics: &diagnostics,
        now_sec,
        since: cursor.since,
        until: cursor.until,
    });
    let model = build_notifications_feed_view(NotificationsFeedViewInput {
        owner: owner.to_owned(),
        active_pubkey,
        source_state,
        selected_relays,
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(cursor.since),
        now_sec,
        page_size: PAGE_SIZE,
        window,
        notification_rows,
        width_px: VIEW_WIDTH_PX,
        font_scale: VIEW_FONT_SCALE,
        geometry_models,
        fragment_config: FeedFragmentConfig::default(),
        diagnostics,
    });
    NotificationsFeedLoad {
        model,
        base: relay.clone(),
        relay,
    }
}
