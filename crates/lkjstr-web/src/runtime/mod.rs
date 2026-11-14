//! The app runtime: one store, one relay pool, one planner. Tiles register
//! wants; the runtime plans, talks to relays, ingests, persists and exposes
//! revision signals the UI re-reads.

mod accounts;
mod deadline;
mod ingest;
mod net;
mod persist;
mod publish;
mod relay_msg;
pub mod session;
pub mod status;

use std::cell::RefCell;
use std::collections::{BTreeMap, VecDeque};
use std::rc::Rc;

use leptos::prelude::*;
use lkjstr_core::plan::{RelayDefaults, Want, WantId};
use lkjstr_core::relays::Scores;
use lkjstr_core::store::Store;
use lkjstr_protocol::NostrEvent;
use web_sys::IdbDatabase;

pub use net::Net;
pub use publish::{PubState, Publish};
pub use session::Session;

/// Events kept in memory; the oldest are evicted (IndexedDB keeps more).
const STORE_CAP: usize = 20_000;

#[derive(Clone, Debug, PartialEq)]
pub enum Storage {
    Opening,
    Ready { loaded: usize },
    Unavailable(String),
    WriteFailed(String),
}

pub struct Rt {
    pub store: Store,
    pub scores: Scores,
    pub defaults: RelayDefaults,
    pub net: Net,
    pub session: Session,
    session_busy: bool,
    pub publishes: VecDeque<Publish>,
    pub storage: Storage,
    /// One user-facing message (an action that failed), shown as a toast.
    pub notice: Option<String>,
    wants: BTreeMap<WantId, Want>,
    next_want: WantId,
    /// Both maps are bounded by current visible wants and released on drop.
    deadlines: BTreeMap<WantId, TimeoutHandle>,
    expired: BTreeMap<WantId, lkjstr_core::requests::Deadline>,
    incoming: VecDeque<(String, NostrEvent)>,
    unsaved: lkjstr_core::persistence::PendingEvents,
    flags: Flags,
    db: Option<IdbDatabase>,
    app: Option<App>,
}

#[derive(Default)]
struct Flags {
    replan: bool,
    ingest: bool,
    persist: bool,
    rev: bool,
}

/// Copyable handle to the runtime plus the signals views track.
#[derive(Clone, Copy)]
pub struct App {
    rt: StoredValue<Rc<RefCell<Rt>>, LocalStorage>,
    /// Bumps when stored events change.
    pub rev: RwSignal<u64>,
    /// Bumps when relay or request status changes.
    pub net_rev: RwSignal<u64>,
    /// Bumps when accounts or publishing state change.
    pub session_rev: RwSignal<u64>,
}

pub fn default_relays() -> RelayDefaults {
    let list = |urls: &[&str]| urls.iter().map(|url| format!("wss://{url}/")).collect();
    RelayDefaults {
        read: list(&[
            "nos.lol",
            "relay.damus.io",
            "relay.primal.net",
            "yabu.me",
            "relay-jp.nostr.wirednet.jp",
            "r.kojira.io",
        ]),
        indexers: list(&[
            "purplepag.es",
            "directory.yabu.me",
            "indexer.coracle.social",
        ]),
        search: list(&["search.nos.today", "relay.nostr.band", "relay.noswhere.com"]),
    }
}

impl App {
    pub fn new() -> App {
        let rt = Rt {
            store: Store::with_caps(STORE_CAP - 4_000, 4_000),
            scores: Scores::default(),
            defaults: default_relays(),
            net: Net::default(),
            session: Session::default(),
            session_busy: false,
            publishes: VecDeque::new(),
            storage: Storage::Opening,
            notice: None,
            wants: BTreeMap::new(),
            next_want: 1,
            deadlines: BTreeMap::new(),
            expired: BTreeMap::new(),
            incoming: VecDeque::new(),
            unsaved: Default::default(),
            flags: Flags::default(),
            db: None,
            app: None,
        };
        let app = App {
            rt: StoredValue::new_local(Rc::new(RefCell::new(rt))),
            rev: RwSignal::new(0),
            net_rev: RwSignal::new(0),
            session_rev: RwSignal::new(0),
        };
        app.update(|rt| rt.app = Some(app));
        app
    }

    /// Reads runtime state. Never nest `with` inside `update`.
    pub fn with<T>(&self, read: impl FnOnce(&Rt) -> T) -> T {
        self.rt.with_value(|rt| read(&rt.borrow()))
    }

    pub fn update<T>(&self, edit: impl FnOnce(&mut Rt) -> T) -> T {
        self.rt.with_value(|rt| edit(&mut rt.borrow_mut()))
    }

    /// Registers a want and returns its id; replanning is debounced.
    pub fn want(&self, want: Want) -> WantId {
        let id = self.update(|rt| {
            let id = rt.alloc_want();
            rt.wants.insert(id, want);
            rt.schedule_replan(30);
            id
        });
        self.watch_want(id);
        id
    }

    pub fn set_want(&self, id: WantId, want: Want) {
        let changed = self.update(|rt| {
            if rt.wants.get(&id) == Some(&want) {
                return false;
            }
            rt.wants.insert(id, want);
            rt.expired.remove(&id);
            rt.schedule_replan(30);
            true
        });
        if changed {
            self.watch_want(id);
        }
    }

    pub fn drop_want(&self, id: WantId) {
        self.cancel_deadline(id);
        self.update(|rt| {
            rt.expired.remove(&id);
            if rt.wants.remove(&id).is_some() {
                rt.schedule_replan(200);
            }
        });
    }
}

impl Default for App {
    fn default() -> Self {
        App::new()
    }
}

impl Rt {
    fn app(&self) -> Option<App> {
        self.app
    }

    /// The only place want ids are handed out (tiles and the session share it).
    fn alloc_want(&mut self) -> WantId {
        let id = self.next_want;
        self.next_want += 1;
        id
    }

    pub fn wants(&self) -> &BTreeMap<WantId, Want> {
        &self.wants
    }

    pub fn schedule_replan(&mut self, delay_ms: u64) {
        if self.flags.replan {
            return;
        }
        self.flags.replan = true;
        let Some(app) = self.app() else {
            return;
        };
        crate::host::after(delay_ms, move || {
            app.update(|rt| {
                rt.flags.replan = false;
                rt.replan();
            });
            app.net_rev.update(|rev| *rev += 1);
        });
    }
}
