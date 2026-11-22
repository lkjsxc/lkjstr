//! Only weak Host references cross awaits; late results may release resources, never a reused face.
use super::*;
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
    let (database, raw, picture) = {
        let mut h = host.borrow_mut();
        if h.stopped || !h.avatars.book.current(ticket) {
            return;
        }
        h.avatars
            .effects
            .insert(ticket.job, (ticket.stage, controller.clone()));
        (
            h.avatars.database.clone(),
            if ticket.stage == Stage::Derive {
                h.avatars.raw.remove(&ticket.job)
            } else {
                None
            },
            h.avatars.pictures.get(&ticket.job).cloned(),
        )
    };
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        let signal = controller.signal();
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
            Stage::Fetch => match browser::get(&work.key, &controller).await {
                Ok(blob) => (
                    Completion::Fetched {
                        bytes: blob.size() as u64,
                    },
                    Payload::Raw(blob),
                ),
                Err(error) => (Completion::Failed(error), Payload::None),
            },
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
                Some(picture) => match browser::put(&database, &work.key, picture, &signal).await {
                    Ok(picture) => (Completion::Stored, Payload::Picture(picture)),
                    Err(_) => (Completion::StoreUnavailable, Payload::None),
                },
                None => (
                    Completion::Failed(policy::Failure::Transient),
                    Payload::None,
                ),
            },
        };
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
