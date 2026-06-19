use std::cell::{Cell, RefCell};
use std::collections::{BTreeMap, BTreeSet};
use std::rc::Rc;

use lkjstr_app::UserTimelineFeedView;
use lkjstr_relays::initial_relay_subscription_id;

use crate::{
    relay_host::{BrowserTimeout, RelaySocketHandle},
    relay_read_handle::RelayReadHandle,
    user_timeline_host::UserTimelineHost,
    user_timeline_relay_input::UserTimelineRelayReadInput,
    user_timeline_relay_read::{connect_socket, install_timeout},
};

#[cfg(debug_assertions)]
pub(crate) use crate::user_timeline_relay_store::store_user_timeline_relay_event;

pub(crate) fn start_user_timeline_relay_read(
    host: UserTimelineHost,
    input: UserTimelineRelayReadInput,
    complete: impl Fn(UserTimelineFeedView) + 'static,
) -> Option<RelayReadHandle> {
    if input.relays.is_empty() {
        return None;
    }
    let read = Rc::new(UserTimelineRelayRead {
        host,
        sub_id: initial_relay_subscription_id("user-timeline-follow", Some(&input.target_pubkey)),
        input,
        sockets: RefCell::new(BTreeMap::new()),
        timeout: RefCell::new(None),
        stopped: Cell::new(false),
        cancelled: Cell::new(false),
        events_seen: Cell::new(0),
        relay_done: RefCell::new(BTreeSet::new()),
        relay_outcomes: RefCell::new(BTreeMap::new()),
        complete: Box::new(complete),
    });
    let handle = RelayReadHandle::from_rc(&read, UserTimelineRelayRead::cancel);
    install_timeout(read.clone());
    for relay in read.input.relays.clone() {
        connect_socket(read.clone(), relay);
    }
    Some(handle)
}

pub(super) struct UserTimelineRelayRead {
    pub(super) host: UserTimelineHost,
    pub(super) input: UserTimelineRelayReadInput,
    pub(super) sub_id: String,
    pub(super) sockets: RefCell<BTreeMap<String, RelaySocketHandle>>,
    pub(super) timeout: RefCell<Option<BrowserTimeout>>,
    pub(super) stopped: Cell<bool>,
    pub(super) cancelled: Cell<bool>,
    pub(super) events_seen: Cell<usize>,
    pub(super) relay_done: RefCell<BTreeSet<String>>,
    pub(super) relay_outcomes: RefCell<BTreeMap<String, crate::user_timeline_relay_outcome::UserTimelineRelayOutcome>>,
    pub(super) complete: Box<dyn Fn(UserTimelineFeedView)>,
}
