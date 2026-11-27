//! Coalesce inputs into short work turns and keep a bounded housekeeping deadline.
use super::*;
use crate::{browser::timer::Timer, measure};
use std::rc::Weak;

const VERIFY_DELAY_MS: u32 = 4;
const WORK_DELAY_MS: u32 = 25;
const QUIET_DELAY_MS: u32 = 500;
const INPUT_GRACE_MS: f64 = 100.0;

#[derive(Default)]
pub(super) struct Schedule {
    host: Weak<RefCell<Host>>,
    timer: Option<(Timer, u32)>,
    active_until: f64,
}

impl Schedule {
    pub(super) fn cancel(&mut self) {
        self.timer.take();
    }

    #[cfg(feature = "harness")]
    pub(super) fn is_armed(&self) -> bool {
        self.timer.is_some()
    }

    fn arm(&mut self, delay: u32) {
        if self
            .timer
            .as_ref()
            .is_some_and(|(_, armed)| *armed <= delay)
        {
            return;
        }
        let weak = self.host.clone();
        self.timer = Timer::after(delay, move || {
            if let Some(host) = weak.upgrade() {
                turn(&host);
            }
        })
        .ok()
        .map(|timer| (timer, delay));
    }
}

impl Host {
    pub(super) fn wake(&mut self) {
        if !self.stopped {
            self.schedule.active_until = measure::now() + INPUT_GRACE_MS;
            self.schedule.arm(WORK_DELAY_MS);
        }
    }
}

pub(super) fn start(host: &Rc<RefCell<Host>>) {
    let mut h = host.borrow_mut();
    h.schedule.host = Rc::downgrade(host);
    h.wake();
}

fn turn(host: &Rc<RefCell<Host>>) {
    let busy = {
        let mut h = host.borrow_mut();
        h.schedule.cancel();
        run(&mut h)
    };
    pump(host);
    let mut h = host.borrow_mut();
    if !h.stopped {
        // Yield between 32-event slices so commands and socket callbacks can run.
        let delay = if h.engine.verification_ready() {
            VERIFY_DELAY_MS
        } else if busy || measure::now() < h.schedule.active_until {
            WORK_DELAY_MS
        } else {
            // The core also ages requests, expirations and retry deadlines without input.
            QUIET_DELAY_MS
        };
        h.schedule.arm(delay);
    }
}

fn run(h: &mut Host) -> bool {
    use lkjstr_core::engine::TickPhase;

    let at = h.time();
    let begin = measure::now();
    let mut phase_begin = begin;
    let work = h.engine.tick_observed(at, |phase| {
        let activity = match phase {
            TickPhase::Verify => sign_trace::Activity::Verify,
            TickPhase::Plan => sign_trace::Activity::Plan,
            TickPhase::Render => sign_trace::Activity::Render,
        };
        h.sign_trace.span(activity, phase_begin);
        phase_begin = measure::now();
    });
    let mut timeline_pending = false;
    for (id, session) in &h.sessions {
        let mut session = session.borrow_mut();
        for out in session.timeline_tick(&h.engine, at) {
            h.scope.direct(*id, &out);
        }
        timeline_pending |= session.timeline_pending(&h.engine);
    }
    h.sign_trace
        .span(sign_trace::Activity::Timeline, phase_begin);
    h.engine.metrics.tick(measure::now() - begin);
    work || timeline_pending
}
