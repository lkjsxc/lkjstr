use lkjstr_domain::{RelaySet, default_user_relay_set, seed_relay_sets};
use lkjstr_storage::StorageOutcome;

use crate::{
    relay_selection::selected_read_relays,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_relay_sets_all,
};

pub(crate) struct PublicReadRelays {
    pub(crate) relays: Vec<String>,
    pub(crate) diagnostic: Option<String>,
}

pub(crate) async fn effective_public_read_relays(
    db_name: &str,
    worker_url: &str,
    now_ms: u64,
) -> PublicReadRelays {
    match stored_public_read_relays(db_name, worker_url, now_ms).await {
        StorageOutcome::Ok(relays) => PublicReadRelays {
            relays,
            diagnostic: None,
        },
        outcome => fallback_public_read_relays(now_ms, outcome),
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

fn fallback_public_read_relays<T>(now_ms: u64, outcome: StorageOutcome<T>) -> PublicReadRelays {
    let reason = outcome
        .problem()
        .map(|problem| problem.reason)
        .unwrap_or("unknown");
    PublicReadRelays {
        relays: selected_read_relays(&[read_only_default_set(now_ms)]),
        diagnostic: Some(format!(
            "Relay settings unavailable: {reason}; using session default public read relays."
        )),
    }
}

fn read_only_default_set(now_ms: u64) -> RelaySet {
    let mut set = default_user_relay_set(now_ms);
    set.name = "Session Default Public Read".to_owned();
    for relay in &mut set.relays {
        relay.write = false;
    }
    set
}
