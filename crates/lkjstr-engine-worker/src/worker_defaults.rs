//! Relay usage is supplied explicitly by the frontend.
use super::*;
pub(super) fn initial_engine() -> Engine {
    let mut engine = Engine::new();
    engine.calendar = Box::new(super::calendar::BrowserCalendar::default());
    engine
}
