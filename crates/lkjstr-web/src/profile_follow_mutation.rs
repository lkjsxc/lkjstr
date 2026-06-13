use lkjstr_domain::{Account, SignerType, seed_relay_sets};
use lkjstr_protocol::{NostrEvent, is_pubkey};
use lkjstr_storage::{StorageOutcome, StoredEventRecord, sqlite_event_relay_row};
use lkjstr_ui::{ProfileFollowResult, ProfileFollowToggleCommand};

use crate::{
    accounts_selector_host::resolve_active_selector,
    host_status::{browser_now_ms, problem_status},
    profile_follow_event::signed_follow_event,
    profile_follow_host::{ProfileFollowHost, result_from_event},
    profile_follow_publish::publish_follow_event,
    relay_selection::selected_write_relays,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{SqliteStore, sqlite_accounts_all, sqlite_event_put, sqlite_relay_sets_all},
};

pub(crate) async fn publish_follow_toggle(
    host: &ProfileFollowHost,
    command: ProfileFollowToggleCommand,
) -> ProfileFollowResult {
    match publish_follow_toggle_inner(host, &command).await {
        Ok(result) => result,
        Err(message) => ProfileFollowResult::new(command.current, message),
    }
}

async fn publish_follow_toggle_inner(
    host: &ProfileFollowHost,
    command: &ProfileFollowToggleCommand,
) -> Result<ProfileFollowResult, String> {
    if !is_pubkey(&command.target_pubkey) {
        return Err("Profile pubkey is invalid.".to_owned());
    }
    let account = active_account(host, &command.account_pubkey).await?;
    let relays = write_relays(host).await?;
    if relays.is_empty() {
        return Err("Enable at least one write relay.".to_owned());
    }
    let event = signed_follow_event(host, &account, command).await?;
    let accepted = accepted_relays(&relays, &event).await?;
    store_published_event(host, &event, &accepted).await?;
    Ok(result_from_event(&event, &command.target_pubkey, ""))
}

async fn active_account(host: &ProfileFollowHost, expected_pubkey: &str) -> Result<Account, String> {
    let accounts = with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_accounts_all(&store).await
    })
    .await;
    let accounts = match accounts {
        StorageOutcome::Ok(accounts) => accounts,
        outcome => return Err(problem_status("Accounts unavailable", outcome)),
    };
    let selector = resolve_active_selector(&host.db_name, &host.worker_url, &accounts).await;
    if let Some(status) = selector.status {
        return Err(status);
    }
    let account = selector
        .active_id
        .and_then(|id| accounts.into_iter().find(|item| item.id == id))
        .ok_or_else(|| "Add a signing account first.".to_owned())?;
    if account.pubkey != expected_pubkey {
        return Err("Active account changed before profile follow publish.".to_owned());
    }
    match account.signer_type {
        SignerType::Local | SignerType::Nip07 => Ok(account),
        SignerType::Readonly => Err("Select an account that can sign.".to_owned()),
    }
}

async fn write_relays(host: &ProfileFollowHost) -> Result<Vec<String>, String> {
    let now = browser_now_ms();
    let relays = with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        match sqlite_relay_sets_all(&store).await {
            StorageOutcome::Ok(rows) => {
                StorageOutcome::Ok(selected_write_relays(&seed_relay_sets(&rows, now)))
            }
            outcome => outcome.map(|_| Vec::new()),
        }
    })
    .await;
    match relays {
        StorageOutcome::Ok(relays) => Ok(relays),
        outcome => Err(problem_status("Relay settings unavailable", outcome)),
    }
}

async fn accepted_relays(relays: &[String], event: &NostrEvent) -> Result<Vec<String>, String> {
    let results = publish_follow_event(relays, event).await;
    let accepted = results
        .iter()
        .filter_map(|result| result.as_ref().ok().cloned())
        .collect::<Vec<_>>();
    if !accepted.is_empty() {
        return Ok(accepted);
    }
    Err(results
        .into_iter()
        .find_map(Result::err)
        .unwrap_or_else(|| "All write relays rejected the follow event.".to_owned()))
}

async fn store_published_event(
    host: &ProfileFollowHost,
    event: &NostrEvent,
    relays: &[String],
) -> Result<(), String> {
    let now = browser_now_ms();
    let row = StoredEventRecord {
        event: event.clone(),
        received_at_ms: now,
        updated_at_ms: now,
    };
    let relay_rows = relays
        .iter()
        .map(|relay| sqlite_event_relay_row(&event.id, relay, now, "profile-follow-publish"))
        .collect::<Vec<_>>();
    let outcome = with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        put_event(&store, &row, &relay_rows).await
    })
    .await;
    match outcome {
        StorageOutcome::Ok(()) => Ok(()),
        outcome => Err(problem_status("Profile follow cache update failed", outcome)),
    }
}

async fn put_event(
    store: &SqliteStore,
    row: &StoredEventRecord,
    relays: &[lkjstr_storage::SqliteEventRelayRow],
) -> StorageOutcome<()> {
    sqlite_event_put(store, row, relays).await
}
