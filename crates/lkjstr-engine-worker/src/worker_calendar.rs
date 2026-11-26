//! The page's local days for the time rail: the Worker's own `Date` has the page's zone.
use js_sys::{Array, Date, Intl, Object, Reflect};
use lkjstr_core::calendar::Calendar;
use std::cell::RefCell;
use wasm_bindgen::JsValue;

/// Reading the zone builds an `Intl.DateTimeFormat`, so it is read at most once a second; a zone
/// change reaches the time rail on the next count rebuild after that.
#[derive(Default)]
pub(super) struct BrowserCalendar {
    zone: RefCell<Option<(f64, String)>>,
}

impl Calendar for BrowserCalendar {
    fn zone(&self) -> String {
        let now = Date::now();
        let mut held = self.zone.borrow_mut();
        match held.as_ref() {
            Some((at, zone)) if now - at < 1000.0 => zone.clone(),
            _ => {
                let options =
                    Intl::DateTimeFormat::new(&Array::new(), &Object::new()).resolved_options();
                let zone = Reflect::get(&options, &JsValue::from_str("timeZone"))
                    .ok()
                    .and_then(|v| v.as_string())
                    .unwrap_or_default();
                *held = Some((now, zone.clone()));
                zone
            }
        }
    }
    /// Local midnight by `new Date(y, m, d)`, which resolves a skipped midnight to the first
    /// instant after the gap. Times before the epoch clamp to 0.
    fn day_start(&self, ms: u64) -> u64 {
        let day = Date::new(&JsValue::from_f64(ms as f64));
        let start = Date::new_with_year_month_day(
            day.get_full_year(),
            day.get_month() as i32,
            day.get_date() as i32,
        );
        start.get_time().max(0.0) as u64
    }

    fn five_minute_start(&self, ms: u64) -> u64 {
        let date = Date::new(&JsValue::from_f64(ms as f64));
        // Subtract within this occurrence of the hour, including the repeated hour at fall back.
        let elapsed = (date.get_minutes() % 5 * 60 + date.get_seconds()) as u64;
        ms.saturating_sub(elapsed * 1000 + u64::from(date.get_milliseconds()))
    }
}
