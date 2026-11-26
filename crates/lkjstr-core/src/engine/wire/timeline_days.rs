//! Local day boundaries for the time rail (docs/interface-time.md, engine addition), built in the
//! same newest-first scan as the month counts. One entry per local day per UTC month part, so a
//! local day that crosses a UTC month gives two entries with the same `at`, the newer part first.
//! Bound: the newest `MAX_DAYS` occupied days plus one part per month. Older notes have no day
//! parts: a few old posts far below busy recent weeks keep the recent days named, and the rail
//! marks the older months by their UTC month bands.
use crate::calendar::Calendar;
use serde_json::{Value, json};

/// More occupied local days than this cannot be drawn as day marks: the answer names the newest.
pub const MAX_DAYS: usize = 400;

#[derive(Default)]
pub(super) struct Days {
    zone: String,
    today: u64,
    /// (local day start, UTC month start, ordinal of the part's newest note, notes in the part)
    parts: Vec<(u64, u64, usize, usize)>,
    occupied: usize,
    over: bool,
}

impl Days {
    pub(super) fn new(zone: String, today: u64) -> Self {
        Days {
            zone,
            today,
            ..Default::default()
        }
    }
    /// The zone changed, or the local day did (future notes join today's day): rebuild.
    pub(super) fn stale(&self, zone: &str, today: u64) -> bool {
        self.zone != zone || self.today != today
    }
    /// One counted note at `at` ms (already clamped to now), the `offset`-th note of `month`.
    /// Notes arrive newest first, so the calendar is asked once per day, not once per note.
    pub(super) fn count(&mut self, calendar: &dyn Calendar, at: u64, month: u64, offset: usize) {
        if self.over {
            return;
        }
        let day = match self.parts.last() {
            Some(&(start, ..)) if at >= start => start,
            _ => calendar.day_start(at),
        };
        match self.parts.last_mut() {
            Some(last) if last.0 == day && last.1 == month => last.3 += 1,
            last => {
                if last.is_none_or(|l| l.0 != day) {
                    self.occupied += 1;
                }
                if self.occupied > MAX_DAYS {
                    self.over = true;
                    return;
                }
                self.parts.push((day, month, offset, 1));
            }
        }
    }
    /// The `days` and `zone` fields of a Timeline answer; past the bound, the newest days only.
    pub(super) fn fields(&self, value: &mut Value) {
        value["zone"] = json!(self.zone);
        value["days"] = self
            .parts
            .iter()
            .map(|(at, month, offset, count)| {
                json!({"at":at,"month":month,"offset":offset,"count":count})
            })
            .collect();
    }
}
