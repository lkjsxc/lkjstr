//! Account mutation policy runs on a snapshot, committed by the account queue.
use super::*;
use lkjstr_core::engine::wire::actions::Action as A;
pub(super) async fn apply(
    action: A,
    next: &mut lkjstr_core::engine::accounts::Accounts,
    watermark: Option<lkjstr_core::engine::wire::NotificationMark>,
    caller: &bunker::Caller,
) -> Result<Option<String>, &'static str> {
    if keys::is_vault(&action) {
        return keys::apply(next, &action);
    }
    let result = match action {
        A::AccountAdd { how, key } => {
            if how == "key" && key.as_deref().is_some_and(|v| v.starts_with("bunker://")) {
                match lkjstr_protocol::remote::Remote::parse(key.as_deref().unwrap_or("")) {
                    Some((session, token)) => {
                        let pubkey = bunker::discover(caller, &session, token).await?;
                        next.add_remote(pubkey, session)
                    }
                    None => Err("rejected"),
                }
            } else {
                next.add(&how, key.as_deref())
            }
        }
        A::AccountUse { pubkey } => next.use_account(&pubkey),
        A::AccountRemove { pubkey } => next.remove(&pubkey),
        A::Seen { account } => {
            if next.entries.iter().any(|a| a.pubkey == account) {
                let mark = watermark.unwrap_or_default();
                next.seen.insert(account.clone(), mark.at);
                next.notification_ties.insert(account.clone(), mark.ties);
                next.notification_zaps.insert(account, mark.zaps);
                Ok(())
            } else {
                Err("signed-out")
            }
        }
        A::ChannelSeen { account, id } => {
            if !lkjstr_protocol::is_event_id(&id) {
                Err("rejected")
            } else if next.entries.iter().any(|a| a.pubkey == account) {
                let key = format!("channel:{account}:{id}");
                if next.seen.len() >= 4096 && !next.seen.contains_key(&key) {
                    Err("too-large")
                } else {
                    next.seen.insert(key, now());
                    Ok(())
                }
            } else {
                Err("signed-out")
            }
        }
        _ => Err("unsupported"),
    };
    result.map(|_| None)
}
