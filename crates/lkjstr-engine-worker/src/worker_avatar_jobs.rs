//! Only weak Host references cross awaits; late results may release resources, never a reused face.
use super::*;
use crate::browser::fetch_observation::{HttpObservation, clock as observation_clock};
use lkjstr_core::engine::fetch_records::{Lane, Outcome, ResourceClass, Scope, Source, WireBytes};
enum Payload {
    None,
    Raw(web_sys::Blob),
    Picture(browser::Picture),
}
pub(super) fn start(host: &Rc<RefCell<Host>>, work: Work) {
    let ticket = work.ticket;
    let Ok(controller) = web_sys::AbortController::new() else {
        let weak = Rc::downgrade(host);
        wasm_bindgen_futures::spawn_local(async move {
            if let Some(host) = weak.upgrade() {
                settle(
                    &host,
                    ticket,
                    Completion::Failed(policy::Failure::Capability),
                    Payload::None,
                );
            }
        });
        return;
    };
    let (database, raw, picture, public, observer) = {
        let mut h = host.borrow_mut();
        if h.stopped || !h.avatars.book.current(ticket) {
            return;
        }
        h.avatars
            .effects
            .insert(ticket.job, (ticket.stage, controller.clone()));
        let public = h.avatars.book.observable(ticket);
        (
            h.avatars.database.clone(),
            if ticket.stage == Stage::Derive {
                h.avatars.raw.remove(&ticket.job)
            } else {
                None
            },
            h.avatars.pictures.get(&ticket.job).cloned(),
            public,
            if public {
                h.engine.network.fetches.clone()
            } else {
                lkjstr_core::engine::fetch_records::Observer::disabled()
            },
        )
    };
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        let signal = controller.signal();
        let start = observation_clock();
        let mut http = (ticket.stage == Stage::Fetch).then(|| {
            HttpObservation::new(
                observer.clone(),
                ResourceClass::Avatars,
                &work.key,
                &work.key,
                Lane::L1,
            )
        });
        if let Some(r) = http.as_mut().and_then(HttpObservation::record_mut) {
            r.slot = observer.key("avatar");
        }
        let (completion, payload) = match ticket.stage {
            Stage::Lookup => match browser::lookup(&database, &work.key, &signal).await {
                Ok(Some(picture)) => (
                    Completion::Hit {
                        bytes: picture.blob.size() as u64,
                    },
                    Payload::Picture(picture),
                ),
                Ok(None) => (Completion::Miss, Payload::None),
                Err(_) => (Completion::StorageUnavailable, Payload::None),
            },
            Stage::Fetch => 'fetch: {
                let Some(http) = http.as_mut() else {
                    break 'fetch (
                        Completion::Failed(policy::Failure::Transient),
                        Payload::None,
                    );
                };
                match browser::get(&work.key, &controller, http).await {
                    Ok(blob) => (
                        Completion::Fetched {
                            bytes: blob.size() as u64,
                        },
                        Payload::Raw(blob),
                    ),
                    Err(error) => (Completion::Failed(error), Payload::None),
                }
            }
            Stage::Derive => match raw {
                Some(raw) => match browser::derive(raw, &signal).await {
                    Ok(picture) => (
                        Completion::Derived {
                            bytes: picture.blob.size() as u64,
                        },
                        Payload::Picture(picture),
                    ),
                    Err(error) => (Completion::Failed(error), Payload::None),
                },
                None => (
                    Completion::Failed(policy::Failure::Transient),
                    Payload::None,
                ),
            },
            Stage::Store => match picture {
                Some(picture) => {
                    match browser::put(&database, &work.key, picture, &signal, public, &observer)
                        .await
                    {
                        Ok(picture) => (Completion::Stored, Payload::Picture(picture)),
                        Err(_) => (Completion::StoreUnavailable, Payload::None),
                    }
                }
                None => (
                    Completion::Failed(policy::Failure::Transient),
                    Payload::None,
                ),
            },
        };
        let status = match completion {
            Completion::Hit { .. }
            | Completion::Fetched { .. }
            | Completion::Derived { .. }
            | Completion::Stored => Outcome::Ok,
            Completion::Miss => Outcome::Miss,
            Completion::StorageUnavailable | Completion::StoreUnavailable => {
                Outcome::StorageUnavailable
            }
            Completion::Cancelled => Outcome::Cancelled,
            Completion::Failed(
                policy::Failure::Unsupported { .. } | policy::Failure::Capability,
            ) => Outcome::Unsupported,
            Completion::Failed(policy::Failure::Transient) if signal.aborted() => {
                Outcome::Cancelled
            }
            Completion::Failed(policy::Failure::Transient) => Outcome::NetworkError,
        };
        if let Some(mut http) = http {
            observer.refetched(ResourceClass::Avatars, &work.key);
            let outcome = if status == Outcome::Ok {
                Some(status)
            } else if http
                .record_mut()
                .is_some_and(|r| matches!(r.outcome, Outcome::HttpStatus(_)))
            {
                None
            } else {
                Some(status)
            };
            http.complete(outcome);
        } else if let Some(mut r) = observer.draft(
            ResourceClass::Avatars,
            match ticket.stage {
                Stage::Lookup => Scope::Lookup,
                Stage::Derive => Scope::Derive,
                _ => Scope::Store,
            },
            &work.key,
            Some(&work.key),
            observation_clock(),
        ) {
            r.start_ms = Some(start);
            r.lane = Lane::L1;
            r.source = if ticket.stage == Stage::Derive {
                Source::Memory
            } else {
                Source::Indexeddb
            };
            r.wire_bytes = WireBytes::Measured(0);
            r.link_ms = Some(0);
            r.outcome = status;
            r.slot = observer.key("avatar");
            if let Payload::Picture(picture) = &payload {
                r.stored_bytes = Some(picture.blob.size() as u64);
            }
            observer.record(r);
        }
        if let Some(host) = weak.upgrade() {
            settle(&host, ticket, completion, payload);
        }
    });
}
fn settle(host: &Rc<RefCell<Host>>, ticket: Ticket, completion: Completion, payload: Payload) {
    {
        let mut h = host.borrow_mut();
        if h.stopped {
            return;
        }
        if h.avatars
            .effects
            .get(&ticket.job)
            .is_some_and(|(stage, _)| *stage == ticket.stage)
        {
            h.avatars.effects.remove(&ticket.job);
        }
        if h.avatars.book.current(ticket) {
            match payload {
                Payload::Raw(blob) => {
                    h.avatars.raw.insert(ticket.job, blob);
                }
                Payload::Picture(picture) => {
                    h.avatars.pictures.insert(ticket.job, picture);
                }
                Payload::None => {}
            }
        }
        let commands = h
            .avatars
            .book
            .complete(ticket, completion, clock().unwrap_or(u64::MAX));
        drawing::apply(&mut h, commands);
    }
    pump(host);
}
