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
        while h.dm.signers.gate.reads().len() < 2 {
            let Some(index) =
                h.dm.queue
                    .iter()
                    .position(|(a, _)| !h.dm.signers.gate.reading(a))
            else {
                break;
            };
            let Some((account, event)) = h.dm.queue.remove(index) else {
                break;
            };
            let Some(client) = h.dm.client(&account) else {
                h.dm.attempted.remove(&(account, event));
                continue;
            };
            let Some(event) = h.engine.store.get(&event) else {
                continue;
            };
            let Ok(epoch) = lifetime::lease(&h, client, &account) else {
                continue;
            };
            let Ok(read) =
                h.dm.signers
                    .gate
                    .begin_read(&account, client, epoch, &event.id)
            else {
                h.dm.attempted.remove(&(account, event.id.clone()));
                h.dm.last_scan = u64::MAX;
                continue;
            };
            jobs.push((read, event));
        }
    }
    for (read, event) in jobs {
        let host = host.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let outcome = decrypt(&host, &read, &event).await;
            let mut h = host.borrow_mut();
            if signers::check_read(&h, &read).is_err() {
                return; // Revocation already released this identity; never touch a replacement.
            }
            h.dm.signers.gate.finish_read(&read);
            let account = read.account();
            match outcome {
                Ok(Decoded::Modern(rumor)) => {
                    if h.dm.inbox.insert(account, rumor).is_err() {
                        let count = h.dm.failures.entry(account.into()).or_default();
                        *count = count.saturating_add(1);
                    }
                }
                Ok(Decoded::Legacy(text)) => {
                    let inserted = dm::routing::nips_event(&event)
                        .and_then(|e| h.dm.inbox.insert_legacy(account, &e, text));
                    if inserted.is_err() {
                        let count = h.dm.failures.entry(account.into()).or_default();
                        *count = count.saturating_add(1);
                    }
                }
                Err("rate-limited" | "too-large" | "offline") => {
                    h.dm.attempted.remove(&(account.into(), event.id.clone()));
                    h.dm.last_scan = u64::MAX;
                }
                Err(_) => {
                    let count = h.dm.failures.entry(account.into()).or_default();
                    *count = count.saturating_add(1);
                }
            }
            h.dm.next_emit = 0;
        });
    }
}
enum Decoded {
    Modern(lkjstr_nips::event::Rumor),
    Legacy(String),
}
async fn decrypt(
    host: &Rc<RefCell<Host>>,
    read: &dm::signers::Read,
    event: &lkjstr_protocol::NostrEvent,
) -> Result<Decoded, &'static str> {
    use lkjstr_core::engine::accounts::secret::SecretText;
    let event = dm::routing::nips_event(event)?;
    let deadline = Deadline::new(uploads::clock());
    let account = read.account();
    if event.data.kind == 4 {
        let peer = lkjstr_nips::nip04::peer(&event, account).map_err(|_| "rejected")?;
        return crypto::read(
            host,
            read,
            &peer,
            "nip04.decrypt",
            event.data.content,
            deadline,
        )
        .await
        .map(Decoded::Legacy);
    }
    lkjstr_nips::gift_external::outer(&event, account).map_err(|_| "rejected")?;
    let text = SecretText::new(
        crypto::read(
            host,
            read,
            &event.data.pubkey,
            "nip44.decrypt",
            event.data.content,
            deadline,
        )
        .await?,
    );
    signers::check_read(&host.borrow(), read)?;
    let seal = lkjstr_nips::gift_external::seal(&text).map_err(|_| "rejected")?;
    let text = SecretText::new(
        crypto::read(
            host,
            read,
            &seal.data.pubkey,
            "nip44.decrypt",
            seal.data.content.clone(),
            deadline,
        )
        .await?,
    );
    signers::check_read(&host.borrow(), read)?;
    lkjstr_nips::gift_external::rumor(&seal, &text, account)
        .map(Decoded::Modern)
        .map_err(|_| "rejected")
}
