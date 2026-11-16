//! Prepare every recipient's envelope before publishing any of them.
use super::*;
use lkjstr_core::engine::{publication_plan::Destination, upload::Deadline};
type Package = (lkjstr_protocol::NostrEvent, Vec<Destination>);
pub(super) fn pump(host: &Rc<RefCell<Host>>) {
    let tasks = {
        let mut h = host.borrow_mut();
        let pending = std::mem::take(&mut h.dm.tasks);
        let mut tasks = Vec::new();
        for (task, epoch) in pending {
            if matches!(task, Task::Seen { .. }) {
                if let Some(code) = h.dm.marks_error {
                    let (client, _, req) = lifetime::identity(&task);
                    h.scope.direct(client, &Session::failure(req.into(), code));
                    continue;
                }
                if !h.dm.marks_ready || h.dm.marks_busy {
                    h.dm.tasks.push((task, epoch));
                    continue;
                }
                h.dm.marks_busy = true;
            }
            h.dm.running += 1;
            tasks.push((task, epoch));
        }
        tasks
    };
    for (task, epoch) in tasks {
        let host = host.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let (client, req, account, outcome) = match task {
                Task::Send {
                    client,
                    req,
                    account,
                    draft,
                } => {
                    let result = prepare(&host, client, &req, &account, epoch, draft).await;
                    (
                        client,
                        req,
                        account,
                        result.map(|(rumor, packages)| (Some(rumor), packages)),
                    )
                }
                Task::Relays {
                    client,
                    req,
                    account,
                    relays,
                } => {
                    let result = advertise(&host, client, &account, epoch, relays).await;
                    (
                        client,
                        req,
                        account,
                        result.map(|package| (None, vec![package])),
                    )
                }
                Task::Seen {
                    client,
                    req,
                    account,
                    conversation,
                } => {
                    let outcome = marks::save(&host, client, &account, epoch, &conversation).await;
                    let mut h = host.borrow_mut();
                    h.dm.marks_busy = false;
                    h.dm.running = h.dm.running.saturating_sub(1);
                    if !h.stopped {
                        h.scope.direct(client, &result(req, outcome.err(), None));
                    }
                    return;
                }
            };
            let mut h = host.borrow_mut();
            h.dm.pending.remove(&(client, req.clone()));
            let outcome = outcome.and_then(|(rumor, packages)| {
                if h.stopped {
                    return Err("offline");
                }
                delivery::begin(&mut h, client, req.clone(), account, epoch, rumor, packages)
            });
            if let Err(code) = outcome {
                h.dm.running = h.dm.running.saturating_sub(1);
                if !h.stopped {
                    h.scope.direct(client, &Session::failure(req, code));
                }
            }
        });
    }
}
async fn prepare(
    host: &Rc<RefCell<Host>>,
    client: u64,
    req: &str,
    account: &str,
    epoch: u64,
    draft: dm::Draft,
) -> Result<(lkjstr_nips::event::Rumor, Vec<Package>), &'static str> {
    let now = host.borrow().time() / 1000;
    let rumor = dm::draft(account, &draft, now)?;
    let recipients = lkjstr_nips::dm::participants(&rumor).map_err(|_| "rejected")?;
    host.borrow_mut()
        .dm
        .pending
        .insert((client, req.into()), recipients.clone());
    for _ in 0..150 {
        {
            let h = host.borrow();
            if h.stopped {
                return Err("offline");
            }
            lifetime::check(&h, client, account, epoch)?;
            if recipients
                .iter()
                .all(|p| dm::routing::inboxes(&h.engine.store, p).is_ok())
            {
                break;
            }
            if recipients.iter().any(|p| {
                h.engine.store.replaceable(p, 10050).is_none()
                    && h.engine.network.list_loaded(&h.engine.store, p, 10050)
            }) {
                return Err("not-found");
            }
        }
        crate::browser::promise::pause(100)
            .await
            .map_err(|_| "internal")?;
    }
    let destinations: BTreeMap<_, _> = {
        let h = host.borrow();
        recipients
            .iter()
            .map(|p| dm::routing::destinations(&h.engine.store, p).map(|d| (p.clone(), d)))
            .collect::<Result<_, _>>()?
    };
    let deadline = Deadline::new(uploads::clock());
    let mut packages = Vec::new();
    for recipient in recipients {
        {
            let h = host.borrow();
            if h.stopped {
                return Err("offline");
            }
            lifetime::check(&h, client, account, epoch)?;
        }
        let text = serde_json::to_string(&rumor).map_err(|_| "internal")?;
        let content = crypto::crypt(
            host,
            client,
            account,
            &recipient,
            "nip44.encrypt",
            text,
            deadline,
        )
        .await?;
        lifetime::check(&host.borrow(), client, account, epoch)?;
        let age = u32::from_le_bytes(crate::browser::random_bytes()?) % 172800;
        let seal = lkjstr_nips::gift_external::unsigned_seal(&rumor, &recipient, content, now, age)
            .map_err(|_| "rejected")?;
        let unsigned = serde_json::from_value(serde_json::to_value(seal).map_err(|_| "internal")?)
            .map_err(|_| "internal")?;
        let signed = uploads::signing::sign(host, client, deadline, unsigned).await?;
        lifetime::check(&host.borrow(), client, account, epoch)?;
        let seal = dm::routing::nips_event(&signed)?;
        let ephemeral = lkjstr_nips::keys::SecretKey::from_bytes(
            *lkjstr_protocol::generate_secret_key().as_bytes(),
        )
        .map_err(|_| "internal")?;
        let params = lkjstr_nips::gift::WrapParameters {
            ephemeral: &ephemeral,
            now,
            seal_age: age,
            wrap_age: u32::from_le_bytes(crate::browser::random_bytes()?) % 172800,
            seal_nonce: crypto::random()?,
            wrap_nonce: crypto::random()?,
            seal_aux: crypto::random()?,
            wrap_aux: crypto::random()?,
        };
        let recipient_bytes = lkjstr_nips::unhex(&recipient).map_err(|_| "rejected")?;
        let wrap = lkjstr_nips::gift_external::wrap_seal(&seal, &recipient_bytes, &params)
            .map_err(|_| "rejected")?;
        let event =
            lkjstr_protocol::parse_nostr_event_json(&wrap.to_json().map_err(|_| "internal")?, None)
                .map_err(|_| "internal")?;
        let routes = destinations.get(&recipient).cloned().ok_or("internal")?;
        packages.push((event, routes));
    }
    Ok((rumor, packages))
}
async fn advertise(
    host: &Rc<RefCell<Host>>,
    client: u64,
    account: &str,
    epoch: u64,
    relays: Vec<String>,
) -> Result<Package, &'static str> {
    let (event, routes) = {
        let h = host.borrow();
        lifetime::check(&h, client, account, epoch)?;
        let event = dm::routing::advertisement(account, &relays, h.time() / 1000)?;
        let own = h
            .engine
            .network
            .known
            .values()
            .filter(|r| r.write)
            .map(|r| r.url.clone())
            .collect();
        let routes = lkjstr_core::engine::publication_plan::plan(
            lkjstr_core::engine::publication_plan::PublicationInput {
                own,
                ..Default::default()
            },
        );
        if !routes.iter().any(|r| r.state == "pending") {
            return Err("no-relays");
        }
        (event, routes)
    };
    let event =
        uploads::signing::sign(host, client, Deadline::new(uploads::clock()), event).await?;
    Ok((event, routes))
}
