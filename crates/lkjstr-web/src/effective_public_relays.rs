use lkjstr_app::read_availability::{EffectiveReadRelays, SessionDefaultReadPolicy};
use lkjstr_domain::{RelaySet, default_user_relay_set, seed_relay_sets};
use lkjstr_storage::StorageOutcome;

use crate::{
    relay_selection::selected_read_relays,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_relay_sets_all,
};

pub(crate) type PublicReadRelays = EffectiveReadRelays;

pub(crate) async fn effective_public_read_relays(
    db_name: &str,
    worker_url: &str,
    now_ms: u64,
) -> PublicReadRelays {
    effective_read_relays(
        db_name,
        worker_url,
        now_ms,
        SessionDefaultReadPolicy::Allowed,
    )
    .await
}

pub(crate) async fn effective_read_relays(
    db_name: &str,
    worker_url: &str,
    now_ms: u64,
    policy: SessionDefaultReadPolicy,
) -> PublicReadRelays {
    match stored_public_read_relays(db_name, worker_url, now_ms).await {
        StorageOutcome::Ok(relays) => EffectiveReadRelays::from_durable_settings(relays),
        outcome => fallback_public_read_relays(now_ms, outcome, policy),
    }
}

async fn stored_public_read_relays(
    db_name: &str,
    worker_url: &str,
    now_ms: u64,
) -> StorageOutcome<Vec<String>> {
    with_sqlite_store(db_name, worker_url, |store| async move {
        match sqlite_relay_sets_all(&store).await {
            StorageOutcome::Ok(rows) => {
                StorageOutcome::Ok(selected_read_relays(&seed_relay_sets(&rows, now_ms)))
            }
            outcome => outcome.map(|_| Vec::new()),
        }
    })
    .await
}

fn fallback_public_read_relays<T>(
    now_ms: u64,
    outcome: StorageOutcome<T>,
    policy: SessionDefaultReadPolicy,
) -> PublicReadRelays {
    let reason = outcome
        .problem()
        .map(|problem| problem.reason)
        .unwrap_or("unknown");
    EffectiveReadRelays::from_unavailable(
        reason,
        policy,
        selected_read_relays(&[read_only_default_set(now_ms)]),
    )
}

fn read_only_default_set(now_ms: u64) -> RelaySet {
    let mut set = default_user_relay_set(now_ms);
    set.name = "Session Default Public Read".to_owned();
    for relay in &mut set.relays {
        relay.write = false;
    }
    set
}
