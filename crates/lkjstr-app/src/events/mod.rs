#![doc = "Pure event display planning."]

pub mod display;

pub use display::{
    EventDisplayCapabilities, EventDisplayChromePolicy, EventDisplayContext, EventDisplayInput,
    EventDisplayPlan, EventDisplayRenderer, plan_event_display, plan_repost_target_display,
};
