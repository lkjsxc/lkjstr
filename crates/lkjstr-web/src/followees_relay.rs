use std::cell::{Cell, RefCell};
use std::collections::{BTreeMap, BTreeSet};
use std::rc::Rc;

use lkjstr_app::FolloweesView;
use lkjstr_relays::initial_relay_subscription_id;

use crate::{
    followees_host::FolloweesHost,
    followees_relay_input::FolloweesRelayReadInput,
    followees_relay_read::{connect_socket, install_timeout},
    relay_host::{BrowserTimeout, RelaySocketHandle},
    relay_read_handle::RelayReadHandle,
};

pub(crate) use crate::followees_relay_read::store_followees_relay_event;

pub(crate) fn start_followees_relay_read(
    host: FolloweesHost,
    input: FolloweesRelayReadInput,
    complete: impl Fn(FolloweesView) + 'static,
) -> Option<RelayReadHandle> {
    if input.relays.is_empty() {
        return None;
    }
    let read = Rc::new(FolloweesRelayRead {
        host,
        sub_id: initial_relay_subscription_id("followees-follow", Some(&input.target_pubkey)),
        input,
        sockets: RefCell::new(BTreeMap::new()),
        timeout: RefCell::new(None),
        stopped: Cell::new(false),
        cancelled: Cell::new(false),
        events_seen: Cell::new(0),
        relay_done: RefCell::new(BTreeSet::new()),
        complete: Box::new(complete),
    });
    let handle = RelayReadHandle::from_rc(&read, FolloweesRelayRead::cancel);
    install_timeout(read.clone());
    for relay in read.input.relays.clone() {
        connect_socket(read.clone(), relay);
    }
    Some(handle)
}

pub(super) struct FolloweesRelayRead {
    pub(super) host: FolloweesHost,
    pub(super) input: FolloweesRelayReadInput,
    pub(super) sub_id: String,
    pub(super) sockets: RefCell<BTreeMap<String, RelaySocketHandle>>,
    pub(super) timeout: RefCell<Option<BrowserTimeout>>,
    pub(super) stopped: Cell<bool>,
    pub(super) cancelled: Cell<bool>,
    pub(super) events_seen: Cell<usize>,
    pub(super) relay_done: RefCell<BTreeSet<String>>,
    pub(super) complete: Box<dyn Fn(FolloweesView)>,
}
