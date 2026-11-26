#![allow(clippy::expect_used)]
//! Local day boundaries beside the month counts (docs/interface-time.md, engine addition).
mod engine_review_support;
use engine_review_support::{accept, event, output};
use lkjstr_core::calendar::{Calendar, Utc};
use lkjstr_core::engine::{Engine, wire::Session};
use serde_json::{Value, json};

const H: i64 = 3_600_000;
const DAY: i64 = 24 * H;
/// 2026-11-22T00:00:00Z
const NOW: u64 = 1_795_305_600_000;

fn local_midnight(ms: i64, offset: i64) -> i64 {
    let local = ms + offset;
    local - local.rem_euclid(DAY)
}
struct Fixed(i64, &'static str);
impl Calendar for Fixed {
    fn zone(&self) -> String {
        self.1.into()
    }
    fn day_start(&self, ms: u64) -> u64 {
        (local_midnight(ms as i64, self.0) - self.0).max(0) as u64
    }
}
/// America/New_York around the end of daylight time on 2026-11-01 (06:00Z).
struct NewYork;
const FALL: i64 = 1_793_512_800_000;
impl Calendar for NewYork {
    fn zone(&self) -> String {
        "America/New_York".into()
    }
    fn day_start(&self, ms: u64) -> u64 {
        let offset = |t: i64| if t < FALL { -4 * H } else { -5 * H };
        let ms = ms as i64;
        let midnight = local_midnight(ms, offset(ms));
        let guess = midnight - offset(ms);
        (midnight - offset(guess)) as u64
    }
}

fn utc(y: i32, m: u32, d: u32, h: u32, min: u32) -> u64 {
    // Days from the civil date (Howard Hinnant), enough for these fixtures.
    let (y, m) = if m <= 2 { (y - 1, m + 9) } else { (y, m - 3) };
    let era = y.div_euclid(400);
    let yoe = (y - era * 400) as i64;
    let doy = (153 * m as i64 + 2) / 5 + d as i64 - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era as i64 * 146_097 + doe - 719_468;
    (days * DAY + h as i64 * H + min as i64 * 60_000) as u64
}

fn setup(calendar: Box<dyn Calendar>, times: &[u64]) -> (Engine, Session) {
    let mut e = Engine::new();
    e.calendar = calendar;
    let mut s = Session::default();
    let owner = event(1_700_000_000, 1, "note", vec![]);
    for (i, at) in times.iter().enumerate() {
        let mut note = owner.clone();
        note.id = format!("{i:064x}");
        note.created_at = at / 1000;
        e.store.insert(note, None);
    }
    let open = json!({"t":"open","sub":"s","query":{"source":"home","account":owner.pubkey}});
    accept(&mut s, &mut e, open, 0);
    let window = json!({"t":"window","sub":"s","anchor":"top","before":0,"after":60});
    accept(&mut s, &mut e, window, 0);
    output(&mut s, &mut e);
    (e, s)
}
fn timeline(s: &mut Session, e: &Engine, now: u64) -> Value {
    let mut result = Value::Null;
    for i in 0..100 {
        for out in s.timeline_tick(e, now + i * 25) {
            result = serde_json::to_value(out).expect("timeline")["timeline"].clone();
        }
    }
    result
}
fn days(data: &Value) -> Vec<(u64, u64, u64, u64)> {
    let field = |d: &Value, k: &str| d[k].as_u64().expect("number");
    data["days"]
        .as_array()
        .expect("days")
        .iter()
        .map(|d| {
            (
                field(d, "at"),
                field(d, "month"),
                field(d, "offset"),
                field(d, "count"),
            )
        })
        .collect()
}

#[test]
fn a_local_day_across_a_utc_month_gives_two_parts_newer_first() {
    let notes = [
        utc(2026, 11, 1, 2, 0),    // 11/01 11:00 JST
        utc(2026, 10, 31, 20, 30), // 11/01 05:30 JST, still the UTC October
        utc(2026, 10, 31, 10, 0),  // 10/31 19:00 JST
        utc(2026, 10, 31, 9, 0),   // 10/31 18:00 JST
    ];
    let (e, mut s) = setup(Box::new(Fixed(9 * H, "Asia/Tokyo")), &notes);
    let data = timeline(&mut s, &e, NOW);
    let (nov, oct) = (utc(2026, 11, 1, 0, 0), utc(2026, 10, 1, 0, 0));
    let first = utc(2026, 10, 31, 15, 0);
    let before = utc(2026, 10, 30, 15, 0);
    assert_eq!(data["zone"], "Asia/Tokyo");
    assert_eq!(
        days(&data),
        vec![(first, nov, 0, 1), (first, oct, 0, 1), (before, oct, 1, 2)]
    );
    // Every place on the rail lies in exactly one part.
    for p in data["positions"].as_array().expect("positions") {
        let (month, offset) = (p["month"].as_u64(), p["offset"].as_u64().expect("offset"));
        let found = days(&data)
            .iter()
            .filter(|d| Some(d.1) == month && d.2 <= offset && offset < d.2 + d.3)
            .count();
        assert_eq!(found, 1, "{p}");
    }
}

#[test]
fn a_25_hour_day_is_one_day_in_new_york() {
    let notes = [
        utc(2026, 11, 2, 6, 0),   // 11/02 01:00 EST
        utc(2026, 11, 2, 4, 30),  // 11/01 23:30 EST
        utc(2026, 11, 1, 23, 0),  // 11/01 18:00 EST
        utc(2026, 11, 1, 4, 30),  // 11/01 00:30 EDT
        utc(2026, 10, 31, 14, 0), // 10/31 10:00 EDT
    ];
    let (e, mut s) = setup(Box::new(NewYork), &notes);
    let data = timeline(&mut s, &e, NOW);
    let (nov, oct) = (utc(2026, 11, 1, 0, 0), utc(2026, 10, 1, 0, 0));
    assert_eq!(
        days(&data),
        vec![
            (utc(2026, 11, 2, 5, 0), nov, 0, 1),
            (utc(2026, 11, 1, 4, 0), nov, 1, 3),
            (utc(2026, 10, 31, 4, 0), oct, 0, 1),
        ]
    );
}

#[test]
fn past_400_occupied_days_the_newest_400_stay_named() {
    // A sparse old tail (one post a day for years) below recent days keeps the recent days.
    let start = utc(2025, 1, 1, 12, 0);
    for count in [400u64, 401, 600] {
        let notes: Vec<u64> = (0..count).map(|i| start + i * DAY as u64).collect();
        let (e, mut s) = setup(Box::new(Utc), &notes);
        let data = timeline(&mut s, &e, NOW);
        assert_eq!(data["supported"], true);
        assert_eq!(data["zone"], "UTC");
        let kept = days(&data);
        assert_eq!(kept.len(), 400, "{count} days");
        let newest = start + (count - 1) * DAY as u64;
        assert_eq!(
            kept[0].0,
            newest - 12 * H as u64,
            "{count} days start at the newest"
        );
        assert_eq!(kept[399].0, newest - 12 * H as u64 - 399 * DAY as u64);
    }
}

#[test]
fn a_zone_change_rebuilds_days_and_future_notes_join_today() {
    let notes = [NOW + 3 * DAY as u64, utc(2026, 11, 20, 23, 0)];
    let (mut e, mut s) = setup(Box::new(Utc), &notes);
    let data = timeline(&mut s, &e, NOW + 13 * H as u64);
    let nov = utc(2026, 11, 1, 0, 0);
    assert_eq!(
        days(&data),
        vec![(NOW, nov, 0, 1), (utc(2026, 11, 20, 0, 0), nov, 1, 1)]
    );
    e.calendar = Box::new(Fixed(9 * H, "Asia/Tokyo"));
    let data = timeline(&mut s, &e, NOW + 13 * H as u64 + 5000);
    assert_eq!(data["zone"], "Asia/Tokyo");
    assert_eq!(
        days(&data),
        vec![
            (NOW - 9 * H as u64, nov, 0, 1),
            (utc(2026, 11, 20, 15, 0), nov, 1, 1)
        ]
    );
}
