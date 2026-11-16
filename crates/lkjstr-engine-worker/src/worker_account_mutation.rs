//! Account mutation policy runs on a snapshot, committed by the account queue.
use super::*;
use lkjstr_core::engine::wire::actions::Action as A;
pub(super) async fn apply(
    action: A,
    next: &mut lkjstr_core::engine::accounts::Accounts,
    watermark: Option<(u64, std::collections::BTreeSet<String>)>,
) -> Result<Option<String>, &'static str> {
    if keys::is_vault(&action) {
        return keys::apply(next, &action);
    }
    let result = match action {
        A::AccountAdd { how, key } => {
            if how == "key" && key.as_deref().is_some_and(|v| v.starts_with("bunker://")) {
                match lkjstr_protocol::remote::Remote::parse(key.as_deref().unwrap_or("")) {
                    Some((session, token)) => {
                        let connect = crate::browser::remote::rpc(
                            &session,
                            "connect",
                            vec![session.peer.clone(), token.unwrap_or_default()],
                        )
                        .await;
                        if connect.is_ok() {
                            match crate::browser::remote::rpc(&session, "get_public_key", vec![])
                                .await
                            {
                                Ok(pubkey) => next.add_remote(pubkey, session),
                                Err(code) => Err(code),
                            }
                        } else {
                            Err(connect.err().unwrap_or("signer-refused"))
                        }
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
                let (at, ties) = watermark.unwrap_or_default();
                next.seen.insert(account.clone(), at);
                next.notification_ties.insert(account, ties);
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
