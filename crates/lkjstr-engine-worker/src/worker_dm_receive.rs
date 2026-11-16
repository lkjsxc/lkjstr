//! Two decryption jobs at a time, released with account/view lifetime.
use super::*;
use lkjstr_core::engine::upload::Deadline;
pub(super) fn pump(host: &Rc<RefCell<Host>>) {
    let mut jobs = Vec::new();
    {
        let mut h = host.borrow_mut();
        if !h.dm.marks_ready {
            return;
        }
        let active = h.dm.active();
        let revision = h.engine.store.revision();
        if h.dm.queue.is_empty() && h.dm.last_scan != revision {
            let events = h.engine.store.feed(&lkjstr_core::store::Query {
                kinds: vec![4, 1059],
                limit: 16000,
                ..Default::default()
            });
            let Host { engine, dm, .. } = &mut *h;
            dm.attempted
                .retain(|(a, id)| active.contains(a) && engine.store.get(id).is_some());
            for event in events {
                for account in &active {
                    if dm.errors.contains_key(account) {
                        continue;
                    }
                    let recipient = event
                        .tags
                        .iter()
                        .any(|t| t.first().is_some_and(|s| s == "p") && t.get(1) == Some(account));
                    if !(recipient || (event.kind == 4 && event.pubkey == *account)) {
                        continue;
                    }
                    let key = (account.clone(), event.id.clone());
                    if !dm.attempted.contains(&key) && dm.attempted.len() < 20000 {
                        dm.attempted.insert(key.clone());
                        dm.queue.push_back(key);
                    }
                    if dm.queue.len() >= 256 {
                        break;
                    }
                }
                if dm.queue.len() >= 256 {
                    break;
                }
            }
            dm.last_scan = if dm.queue.len() >= 256 {
                u64::MAX
            } else {
                revision
            };
        }
        while h.dm.receiving < 2 {
            let Some((account, event)) = h.dm.queue.pop_front() else {
                break;
            };
            let Some(client) = h.dm.client(&account) else {
                h.dm.attempted.remove(&(account, event));
                continue;
            };
            if h.dm.errors.contains_key(&account) {
                continue;
            }
            let Some(event) = h.engine.store.get(&event) else {
                continue;
            };
            let Ok(epoch) = lifetime::lease(&h, client, &account) else {
                continue;
            };
            h.dm.receiving += 1;
            *h.dm.decrypting.entry(account.clone()).or_default() += 1;
            jobs.push((client, account, event, epoch));
        }
    }
    for (client, account, event, epoch) in jobs {
        let host = host.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let outcome = decrypt(&host, client, &account, &event, epoch).await;
            let mut h = host.borrow_mut();
            h.dm.receiving = h.dm.receiving.saturating_sub(1);
            if let Some(n) = h.dm.decrypting.get_mut(&account) {
                *n = n.saturating_sub(1);
            }
            h.dm.decrypting.retain(|_, n| *n > 0);
            if h.stopped
                || lifetime::check(&h, client, &account, epoch).is_err()
                || h.dm.client(&account).is_none()
            {
                h.dm.attempted.remove(&(account, event.id.clone()));
                return;
            }
            match outcome {
                Ok(Decoded::Modern(rumor)) => {
                    if h.dm.inbox.insert(&account, rumor).is_err() {
                        let count = h.dm.failures.entry(account.clone()).or_default();
                        *count = count.saturating_add(1);
                    }
                }
                Ok(Decoded::Legacy(text)) => {
                    let inserted = dm::routing::nips_event(&event)
                        .and_then(|e| h.dm.inbox.insert_legacy(&account, &e, text));
                    if inserted.is_err() {
                        let count = h.dm.failures.entry(account.clone()).or_default();
                        *count = count.saturating_add(1);
                    }
                }
                Err(code)
                    if matches!(code, "signer-missing" | "signer-refused" | "unsupported") =>
                {
                    h.dm.errors.insert(account.clone(), code.into());
                    h.dm.attempted.remove(&(account, event.id.clone()));
                }
                Err(_) => {
                    let count = h.dm.failures.entry(account).or_default();
                    *count = count.saturating_add(1);
                }
            }
        });
    }
}
enum Decoded {
    Modern(lkjstr_nips::event::Rumor),
    Legacy(String),
}
async fn decrypt(
    host: &Rc<RefCell<Host>>,
    client: u64,
    account: &str,
    event: &lkjstr_protocol::NostrEvent,
    epoch: u64,
) -> Result<Decoded, &'static str> {
    let event = dm::routing::nips_event(event)?;
    let deadline = Deadline::new(uploads::clock());
    if event.data.kind == 4 {
        let peer = lkjstr_nips::nip04::peer(&event, account).map_err(|_| "rejected")?;
        return crypto::crypt(
            host,
            client,
            account,
            &peer,
            "nip04.decrypt",
            event.data.content,
            deadline,
        )
        .await
        .map(Decoded::Legacy);
    }
    lkjstr_nips::gift_external::outer(&event, account).map_err(|_| "rejected")?;
    let text = crypto::crypt(
        host,
        client,
        account,
        &event.data.pubkey,
        "nip44.decrypt",
        event.data.content,
        deadline,
    )
    .await?;
    lifetime::check(&host.borrow(), client, account, epoch)?;
    if host.borrow().dm.client(account).is_none() {
        return Err("offline");
    }
    let seal = lkjstr_nips::gift_external::seal(&text).map_err(|_| "rejected")?;
    let text = crypto::crypt(
        host,
        client,
        account,
        &seal.data.pubkey,
        "nip44.decrypt",
        seal.data.content.clone(),
        deadline,
    )
    .await?;
    lifetime::check(&host.borrow(), client, account, epoch)?;
    lkjstr_nips::gift_external::rumor(&seal, &text, account)
        .map(Decoded::Modern)
        .map_err(|_| "rejected")
}
