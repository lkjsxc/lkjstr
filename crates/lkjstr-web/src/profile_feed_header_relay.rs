use std::cell::{Cell, RefCell};
use std::collections::{BTreeMap, BTreeSet};
use std::rc::Rc;

use lkjstr_app::ProfileFeedView;
use lkjstr_relays::initial_relay_subscription_id;

use crate::{
    profile_feed_header_relay_input::ProfileHeaderRelayReadInput,
    profile_feed_header_relay_read::{connect_socket, install_timeout},
    profile_feed_host::ProfileFeedHost,
    relay_host::{BrowserTimeout, RelaySocketHandle},
    relay_read_handle::RelayReadHandle,
};

#[cfg(debug_assertions)]
pub(crate) use crate::profile_feed_header_relay_read::store_profile_header_event;

pub(crate) fn start_profile_header_relay_read(
    host: ProfileFeedHost,
    input: ProfileHeaderRelayReadInput,
    complete: impl Fn(ProfileFeedView) + 'static,
) -> Option<RelayReadHandle> {
    if input.relays.is_empty() {
        return None;
    }
    let read = Rc::new(ProfileHeaderRelayRead {
        host,
        sub_id: initial_relay_subscription_id("profile-header", Some(&input.profile_pubkey)),
        input,
        sockets: RefCell::new(BTreeMap::new()),
        timeout: RefCell::new(None),
        stopped: Cell::new(false),
        cancelled: Cell::new(false),
        events_seen: Cell::new(0),
        relay_done: RefCell::new(BTreeSet::new()),
        complete: Box::new(complete),
    });
    let handle = RelayReadHandle::from_rc(&read, ProfileHeaderRelayRead::cancel);
    install_timeout(read.clone());
    for relay in read.input.relays.clone() {
        connect_socket(read.clone(), relay);
    }
    Some(handle)
}

pub(super) struct ProfileHeaderRelayRead {
    pub(super) host: ProfileFeedHost,
    pub(super) input: ProfileHeaderRelayReadInput,
    pub(super) sub_id: String,
    pub(super) sockets: RefCell<BTreeMap<String, RelaySocketHandle>>,
    pub(super) timeout: RefCell<Option<BrowserTimeout>>,
    pub(super) stopped: Cell<bool>,
    pub(super) cancelled: Cell<bool>,
    pub(super) events_seen: Cell<usize>,
    pub(super) relay_done: RefCell<BTreeSet<String>>,
    pub(super) complete: Box<dyn Fn(ProfileFeedView)>,
}
