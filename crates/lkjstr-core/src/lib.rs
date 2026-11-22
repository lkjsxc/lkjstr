#![doc = "Pure, natively testable core of lkjstr: workspace layout, event store, \
request orchestration, relay scoring and timelines. No browser APIs here."]

pub mod actions;
pub mod cache;
pub mod content;
pub mod kinds;
pub mod layout;
pub mod pagination;
pub mod persistence;
pub mod plan;
pub mod prefetch;
pub mod relays;
pub mod requests;
pub mod store;
pub mod timeline;
pub mod view;
pub mod workspace;

pub use view::{LauncherChoice, View, launcher_choices};
pub use workspace::{Command, Open, Workspace};

pub mod appearance;
pub mod navigation;
pub mod reactions;
pub mod route;
pub mod words;

pub mod reading;
pub mod sizes;
pub mod spaces;
pub mod tab_policy;

mod identities;

pub mod addresses;

mod words_extra;

mod words_format;

mod words_errors;

pub mod engine;
