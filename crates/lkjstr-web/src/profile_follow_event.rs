use lkjstr_domain::{Account, SignerType, sign_local_event};
use lkjstr_protocol::{
    KIND_FOLLOW_LIST, NostrEvent, NostrTag, UnsignedNostrEvent, VerificationResult, verify_event,
};
use lkjstr_storage::{StorageOutcome, StoredEventRecord};
use lkjstr_ui::ProfileFollowToggleCommand;

use crate::{
    host_status::{browser_now_ms, problem_status},
    nip07_host::nip07_sign_event,
    profile_follow_host::{ProfileFollowHost, latest_follow_list_from_store},
    sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_local_secret_get,
};

pub(crate) async fn signed_follow_event(
    host: &ProfileFollowHost,
    account: &Account,
    command: &ProfileFollowToggleCommand,
) -> Result<NostrEvent, String> {
    let current = latest_follow_list(host, &account.pubkey).await?;
    let unsigned = UnsignedNostrEvent {
        pubkey: account.pubkey.clone(),
        created_at: browser_now_ms() / 1_000,
        kind: KIND_FOLLOW_LIST,
        tags: next_follow_tags(current.as_ref().map(|row| &row.event), command),
        content: String::new(),
    };
    let event = match account.signer_type {
        SignerType::Local => sign_local(host, account, &unsigned).await?,
        SignerType::Nip07 => nip07_sign_event(&unsigned).await?,
        SignerType::Readonly => return Err("Select an account that can sign.".to_owned()),
    };
    validate_signed_follow_event(&unsigned, event)
}

async fn sign_local(
    host: &ProfileFollowHost,
    account: &Account,
    unsigned: &UnsignedNostrEvent,
) -> Result<NostrEvent, String> {
    let secret = local_secret(host, account).await?;
    sign_local_event(unsigned, &secret).map_err(|_| "Profile follow signing failed.".to_owned())
}

async fn local_secret(host: &ProfileFollowHost, account: &Account) -> Result<String, String> {
    let account_id = account.id.clone();
    let secret = with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_local_secret_get(&store, &account_id).await
    })
    .await;
    match secret {
        StorageOutcome::Ok(Some(secret)) => Ok(secret.secret_key),
        StorageOutcome::Ok(None) => Err("Local signing secret is unavailable.".to_owned()),
        outcome => Err(problem_status("Local signing secret unavailable", outcome)),
    }
}

async fn latest_follow_list(
    host: &ProfileFollowHost,
    pubkey: &str,
) -> Result<Option<StoredEventRecord>, String> {
    let pubkey = pubkey.to_owned();
    let outcome = with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        latest_follow_list_from_store(&store, &pubkey).await
    })
    .await;
    match outcome {
        StorageOutcome::Ok(row) => Ok(row),
        outcome => Err(problem_status("Profile follow state unavailable", outcome)),
    }
}

fn next_follow_tags(
    current: Option<&NostrEvent>,
    command: &ProfileFollowToggleCommand,
) -> Vec<NostrTag> {
    let mut tags = current
        .map(|event| event.tags.clone())
        .unwrap_or_default()
        .into_iter()
        .filter(|tag| !is_target_follow_tag(tag, &command.target_pubkey))
        .collect::<Vec<_>>();
    if command.follow {
        tags.push(vec!["p".to_owned(), command.target_pubkey.clone()]);
    }
    tags
}

fn is_target_follow_tag(tag: &NostrTag, target_pubkey: &str) -> bool {
    tag.first().is_some_and(|name| name == "p")
        && tag.get(1).is_some_and(|value| value == target_pubkey)
}

fn validate_signed_follow_event(
    unsigned: &UnsignedNostrEvent,
    event: NostrEvent,
) -> Result<NostrEvent, String> {
    if event.pubkey != unsigned.pubkey
        || event.created_at != unsigned.created_at
        || event.kind != unsigned.kind
        || event.tags != unsigned.tags
        || event.content != unsigned.content
    {
        return Err("Profile follow signer returned a different event.".to_owned());
    }
    match verify_event(&event) {
        VerificationResult::Ok(event) => Ok(event),
        VerificationResult::Err { message, .. } => Err(format!(
            "Profile follow signer returned an unverifiable event: {message}"
        )),
    }
}
