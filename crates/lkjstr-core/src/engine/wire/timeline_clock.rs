//! Exact occupied five-minute parts for the calendar ruler. The scan retains at most one part
//! per retained row and only within the newest named days. The answer keeps up to 4096 parts,
//! preferring days with more notes, with complete coverage for every included day.

use serde_json::{Value, json};
use std::cmp::Reverse;

const MAX_PARTS: usize = 4096;

#[derive(Default)]
pub(super) struct Clock {
    days: Vec<ClockDay>,
}

#[derive(Default)]
struct ClockDay {
    notes: usize,
    // [local bucket start in ms, UTC month, first ordinal, count].
    parts: Vec<[u64; 4]>,
}

impl Clock {
    pub(super) fn count(
        &mut self,
        day: usize,
        calendar: &dyn crate::calendar::Calendar,
        at: u64,
        month: u64,
        offset: usize,
    ) {
        if self.days.len() < day {
            self.days.push(ClockDay::default());
        }
        let current = &mut self.days[day - 1];
        current.notes += 1;
        let start = match current.parts.last_mut() {
            Some(last) if at >= last[0] => {
                if last[1] == month {
                    last[3] += 1;
                    return;
                }
                last[0]
            }
            _ => calendar.five_minute_start(at),
        };
        current.parts.push([start, month, offset as u64, 1]);
    }

    pub(super) fn finish(&mut self, answer: &mut Value) {
        let days = std::mem::take(&mut self.days);
        let mut order: Vec<_> = (0..days.len()).collect();
        order.sort_by_key(|&i| Reverse(days[i].notes));
        let mut keep = vec![false; days.len()];
        let mut room = MAX_PARTS;
        for i in order {
            if days[i].parts.len() <= room {
                keep[i] = true;
                room -= days[i].parts.len();
            }
        }
        let parts: Vec<_> = days
            .into_iter()
            .zip(keep)
            .filter(|(_, selected)| *selected)
            .flat_map(|(day, _)| day.parts)
            .collect();
        answer["clock"] = json!(parts);
    }
}
