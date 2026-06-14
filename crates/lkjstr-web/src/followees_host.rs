use lkjstr_app::{
    FollowListSummary, FolloweesView, TargetFollowListState, default_followees_view,
    followees_view_from_summary, summarize_follow_list,
};
use lkjstr_domain::seed_relay_sets;
use lkjstr_protocol::KIND_FOLLOW_LIST;
use lkjstr_relays::AuthorRelayRoute;
use lkjstr_storage::{StorageOutcome, StoredEventRecord};
use lkjstr_ui::FolloweesProvider;

use crate::{
    followees_relay::start_followees_relay_read,
    followees_relay_input::{FolloweesRelayInputSeed, FolloweesRelayReadInput},
    followees_routes::author_routes,
    host_status::browser_now_ms,
    relay_read_handle::RelayReadSlot,
    relay_selection::selected_read_relays,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{SqliteStore, sqlite_events_by_author_kind, sqlite_relay_sets_all},
};

#[derive(Clone)]
pub(crate) struct FolloweesHost {
    pub(crate) db_name: String,
    pub(crate) worker_url: String,
}

pub(crate) struct FolloweesLoad {
    pub(crate) model: FolloweesView,
    pub(crate) relay: Option<FolloweesRelayReadInput>,
}

pub(crate) fn followees_provider_with_worker_url(
    db_name: String,
    worker_url: String,
) -> FolloweesProvider {
    let host = FolloweesHost {
        db_name,
        worker_url,
    };
    FolloweesProvider::new(move |request| {
        let host = host.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let owner = request.owner.clone();
            let target = request.target_pubkey.clone();
            let lease = request.lease();
            let relay_slot = RelayReadSlot::default();
            let release_slot = relay_slot.clone();
            lease.on_release(move || release_slot.cancel());
            if request.is_released() {
                return;
            }
            let load = followees_load(&host, &owner, target).await;
            if request.is_released() {
                return;
            }
            request.complete(load.model);
            let Some(relay_input) = load.relay else {
                return;
            };
            let relay_request = request.clone();
            if let Some(handle) = start_followees_relay_read(host, relay_input, move |model| {
                if !relay_request.is_released() {
                    relay_request.complete(model);
                }
            }) {
                relay_slot.replace(handle);
            }
        });
    })
}

pub(crate) async fn followees_load(
    host: &FolloweesHost,
    owner: &str,
    target_pubkey: Option<String>,
) -> FolloweesLoad {
    let Some(pubkey) = target_pubkey.clone() else {
        return loaded(default_followees_view(owner, None), None);
    };
    let selected = match selected_relays(host).await {
        StorageOutcome::Ok(relays) => relays,
        _ => Vec::new(),
    };
    let routes = match author_routes(host, &pubkey).await {
        StorageOutcome::Ok(routes) => routes,
        _ => Vec::new(),
    };
    match latest_follow_list(host, &pubkey).await {
        StorageOutcome::Ok(Some(row)) => loaded(
            followees_view_from_summary(
                owner,
                target_pubkey,
                TargetFollowListState::CacheHit,
                summarize_follow_list(&row.event),
            ),
            None,
        ),
        StorageOutcome::Ok(None) => loaded(
            loading_model(owner, target_pubkey, &selected, &routes),
            crate::followees_relay_input::followees_relay_input(FolloweesRelayInputSeed {
                owner,
                target_pubkey: &pubkey,
                selected_relays: &selected,
                author_routes: &routes,
            }),
        ),
        _ => loaded(
            followees_view_from_summary(
                owner,
                target_pubkey,
                TargetFollowListState::PartialFailure,
                empty_summary(),
            ),
            None,
        ),
    }
}

pub(crate) async fn followees_model(
    host: &FolloweesHost,
    owner: &str,
    target_pubkey: Option<String>,
) -> FolloweesView {
    followees_load(host, owner, target_pubkey).await.model
}

pub(crate) async fn latest_follow_list(
    host: &FolloweesHost,
    pubkey: &str,
) -> StorageOutcome<Option<StoredEventRecord>> {
    let pubkey = pubkey.to_owned();
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        latest_follow_list_from_store(&store, &pubkey).await
    })
    .await
}

async fn latest_follow_list_from_store(
    store: &SqliteStore,
    pubkey: &str,
) -> StorageOutcome<Option<StoredEventRecord>> {
    match sqlite_events_by_author_kind(store, pubkey, KIND_FOLLOW_LIST, u64::MAX, 1).await {
        StorageOutcome::Ok(mut rows) => StorageOutcome::Ok(rows.pop()),
        outcome => outcome.map(|_| None),
    }
}

async fn selected_relays(host: &FolloweesHost) -> StorageOutcome<Vec<String>> {
    let now = browser_now_ms();
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        match sqlite_relay_sets_all(&store).await {
            StorageOutcome::Ok(rows) => {
                StorageOutcome::Ok(selected_read_relays(&seed_relay_sets(&rows, now)))
            }
            outcome => outcome.map(|_| Vec::new()),
        }
    })
    .await
}

fn loading_model(
    owner: &str,
    target_pubkey: Option<String>,
    selected: &[String],
    author_routes: &[AuthorRelayRoute],
) -> FolloweesView {
    let state = if selected.is_empty() && !author_routes.is_empty() {
        TargetFollowListState::ReadingAuthorRoutes
    } else if selected.is_empty() {
        return default_followees_view(owner, target_pubkey);
    } else {
        TargetFollowListState::ReadingSelected
    };
    followees_view_from_summary(
        owner,
        target_pubkey,
        state,
        empty_summary(),
    )
}

fn empty_summary() -> FollowListSummary {
    FollowListSummary {
        entries: Vec::new(),
        following_count: 0,
    }
}

fn loaded(model: FolloweesView, relay: Option<FolloweesRelayReadInput>) -> FolloweesLoad {
    FolloweesLoad { model, relay }
}
