use std::cell::{Cell, RefCell};
use std::rc::Rc;

use lkjstr_app::HomeFeedView;
use lkjstr_protocol::{
    ClientMessage, KIND_FOLLOW_LIST, NostrEvent, NostrFilter, RelayMessage, encode_client_message,
};
use lkjstr_relays::{
    InitialProgressiveRead, PageReadSurface, ProgressiveReadState, initial_progressive_read,
    request_timeout_ms,
};

use crate::{
    home_feed_relay_input::{HomeFollowReadInput, HomeRelayReadInput},
    home_feed_relay_status::RelayEnd,
    host_status::browser_now_ms,
    relay_host::{BrowserTimeout, RelaySocketCallbacks, RelaySocketHandle, RelaySocketMessage},
    relay_read_handle::RelayReadHandle,
};

pub(crate) fn start_home_follow_read(
    input: HomeFollowReadInput,
    complete: impl Fn(HomeFeedView) + 'static,
    follow_loaded: impl Fn(HomeRelayReadInput) + 'static,
) -> Option<RelayReadHandle> {
    if input.selected_relays.is_empty() {
        return None;
    }
    let read = Rc::new(HomeFollowRead {
        sub_id: format!("home-follow:{}", input.owner),
        input,
        state: RefCell::new(initial_progressive_read(InitialProgressiveRead {
            read_id: "home-follow".to_owned(),
            surface: Some(PageReadSurface::Home),
            relays: Vec::new(),
            started_at_ms: browser_now_ms(),
        })),
        sockets: RefCell::new(Vec::new()),
        timeout: RefCell::new(None),
        latest: RefCell::new(None),
        latest_relay: RefCell::new(None),
        done: Cell::new(false),
        complete: Box::new(complete),
        follow_loaded: Box::new(follow_loaded),
    });
    read.reset_state();
    let handle = RelayReadHandle::from_rc(&read, HomeFollowRead::cancel);
    read.install_timeout();
    for relay in read.input.selected_relays.clone() {
        connect(read.clone(), relay);
    }
    Some(handle)
}

pub(super) struct HomeFollowRead {
    pub(super) input: HomeFollowReadInput,
    pub(super) sub_id: String,
    pub(super) state: RefCell<ProgressiveReadState>,
    pub(super) sockets: RefCell<Vec<(String, RelaySocketHandle)>>,
    pub(super) timeout: RefCell<Option<BrowserTimeout>>,
    pub(super) latest: RefCell<Option<NostrEvent>>,
    pub(super) latest_relay: RefCell<Option<String>>,
    pub(super) done: Cell<bool>,
    pub(super) complete: Box<dyn Fn(HomeFeedView)>,
    pub(super) follow_loaded: Box<dyn Fn(HomeRelayReadInput)>,
}

fn connect(read: Rc<HomeFollowRead>, relay: String) {
    let callbacks = RelaySocketCallbacks::new(
        {
            let read = read.clone();
            let relay = relay.clone();
            move || read.opened(&relay)
        },
        {
            let read = read.clone();
            let relay = relay.clone();
            move |message| read.message(&relay, message)
        },
        {
            let read = read.clone();
            let relay = relay.clone();
            move |_event| read.finish_relay(&relay, RelayEnd::Error)
        },
        {
            let read = read.clone();
            let relay = relay.clone();
            move |_event| read.finish_relay(&relay, RelayEnd::Closed)
        },
    );
    match RelaySocketHandle::connect(&relay, callbacks) {
        Ok(handle) => read.sockets.borrow_mut().push((relay, handle)),
        Err(_problem) => read.finish_relay(&relay, RelayEnd::Error),
    }
}

impl HomeFollowRead {
    fn reset_state(&self) {
        self.state.replace(initial_progressive_read(InitialProgressiveRead {
            read_id: self.sub_id.clone(),
            surface: Some(PageReadSurface::Home),
            relays: self.input.selected_relays.clone(),
            started_at_ms: browser_now_ms(),
        }));
    }

    fn install_timeout(self: &Rc<Self>) {
        let timer = BrowserTimeout::schedule(request_timeout_ms() as u32, {
            let read = self.clone();
            move || read.timeout()
        });
        if let Ok(timer) = timer {
            self.timeout.borrow_mut().replace(timer);
        }
    }

    fn opened(&self, relay: &str) {
        if self.done.get() {
            return;
        }
        self.apply_status(relay, RelayEnd::Connected);
        let frame = encode_client_message(&ClientMessage::Req {
            subscription_id: self.sub_id.clone(),
            filters: vec![follow_filter(&self.input.active_pubkey)],
        });
        if let Ok(frame) = frame
            && let Some((_relay, handle)) = self
                .sockets
                .borrow()
                .iter()
                .find(|(socket_relay, _handle)| socket_relay == relay)
            && handle.send_text(&frame).is_ok()
        {
            return;
        }
        self.finish_relay(relay, RelayEnd::Error);
    }

    fn message(&self, relay: &str, message: RelaySocketMessage) {
        match message {
            RelaySocketMessage::Relay(RelayMessage::Event {
                subscription_id,
                event,
            }) if subscription_id == self.sub_id => self.event(relay, event),
            RelaySocketMessage::Relay(RelayMessage::Eose(subscription_id))
                if subscription_id == self.sub_id =>
            {
                self.finish_relay(relay, RelayEnd::Eose)
            }
            RelaySocketMessage::Relay(RelayMessage::Closed { subscription_id, .. })
                if subscription_id == self.sub_id =>
            {
                self.finish_relay(relay, RelayEnd::Closed)
            }
            RelaySocketMessage::Relay(RelayMessage::Auth(_)) => {
                self.finish_relay(relay, RelayEnd::Auth);
            }
            RelaySocketMessage::ParseError { .. } => self.finish_relay(relay, RelayEnd::Error),
            _ => {}
        }
    }

    fn event(&self, relay: &str, event: NostrEvent) {
        if self.done.get() || !is_follow_event(&self.input.active_pubkey, &event) {
            return;
        }
        if newer_than_latest(&self.latest.borrow(), &event) {
            self.latest.replace(Some(event));
            self.latest_relay.replace(Some(relay.to_owned()));
            self.apply_status(relay, RelayEnd::Reading);
            self.publish_loaded();
        }
    }
}

fn follow_filter(pubkey: &str) -> NostrFilter {
    NostrFilter {
        authors: Some(vec![pubkey.to_owned()]),
        kinds: Some(vec![KIND_FOLLOW_LIST]),
        limit: Some(1),
        ..NostrFilter::default()
    }
}

fn is_follow_event(pubkey: &str, event: &NostrEvent) -> bool {
    event.pubkey == pubkey && event.kind == KIND_FOLLOW_LIST
}

fn newer_than_latest(latest: &Option<NostrEvent>, event: &NostrEvent) -> bool {
    latest.as_ref().is_none_or(|current| {
        (event.created_at, event.id.as_str()) > (current.created_at, current.id.as_str())
    })
}
