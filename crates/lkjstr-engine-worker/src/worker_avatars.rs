//! Avatar leases are independent of account boot; all payloads stay in bounded effect maps.
use super::*;
use crate::browser::{avatar as browser, storage_inspection::now as clock};
use lkjstr_core::engine::{avatars::jobs as policy, wire::Input as W};
use policy::{Command, Completion, ResultKind, Stage, Ticket, Work};
#[path = "worker_avatar_draw.rs"]
mod drawing;
#[path = "worker_avatar_jobs.rs"]
mod jobs;
#[derive(Default)]
pub(super) struct State {
    pub(super) book: policy::Book,
    database: browser::Database,
    // At most four raw credits; lookup/store/codec permit bounds cover temporary derived payloads.
    raw: BTreeMap<u64, web_sys::Blob>,
    pictures: BTreeMap<u64, browser::Picture>,
    effects: BTreeMap<u64, (Stage, web_sys::AbortController)>,
}
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ImageInfo {
    edge: u32,
    source_width: u32,
    source_height: u32,
    bytes: u64,
    mime: String,
}
#[derive(serde::Serialize)]
pub(super) struct Envelope<'a> {
    t: &'static str,
    req: &'a str,
    result: ResultKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    image: Option<ImageInfo>,
}
pub(super) fn input(h: &mut Host, client: u64, input: &W) -> bool {
    let avatar = matches!(input, W::AvatarWant { .. } | W::AvatarClose { .. });
    if !h.sessions.contains_key(&client) {
        return avatar;
    }
    if h.storage.replaying_startup && matches!(input, W::Hint { .. } | W::Detach) {
        return false;
    }
    let commands = match input {
        W::AvatarWant {
            req,
            url,
            observe_public,
        } => match clock() {
            Some(at) => h.avatars.book.want_observed(
                policy::Owner {
                    client,
                    request: req.clone(),
                },
                url,
                at,
                *observe_public,
            ),
            None => vec![Command::Reply {
                owner: policy::Owner {
                    client,
                    request: req.clone(),
                },
                job: None,
                result: ResultKind::Fallback { uniform: false },
            }],
        },
        W::AvatarClose { req } => h.avatars.book.release(&policy::Owner {
            client,
            request: req.clone(),
        }),
        W::Hint { hint } if hint.page_hidden => h.avatars.book.detach(client),
        W::Detach => h.avatars.book.detach(client),
        _ => Vec::new(),
    };
    drawing::apply(h, commands);
    avatar
}
pub(super) fn detach(h: &mut Host, client: u64) {
    let commands = h.avatars.book.detach(client);
    drawing::apply(h, commands);
}
pub(super) fn stop(h: &mut Host) {
    for (_, controller) in h.avatars.effects.values() {
        controller.abort();
    }
    h.avatars.database.close();
    h.avatars.effects.clear();
    h.avatars.raw.clear();
    h.avatars.pictures.clear();
    h.avatars.book = Default::default();
}
pub(super) fn pump(host: &Rc<RefCell<Host>>) {
    let work = {
        let mut h = host.borrow_mut();
        if h.stopped {
            return;
        }
        let commands = match clock() {
            Some(at) => h.avatars.book.pump(at),
            None => h.avatars.book.expire(u64::MAX),
        };
        drawing::apply(&mut h, commands)
    };
    for work in work {
        jobs::start(host, work);
    }
}
