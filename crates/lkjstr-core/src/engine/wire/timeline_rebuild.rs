//! Keep the previous map while its replacement is built, unless coverage shrank.
use super::{Engine, Index, Session, Value, json};

impl Index {
    /// Keep answering moved windows while a replacement builds. Window-only changes reuse the
    /// retained calendar counts and lookup instead of rebuilding or cloning an unchanged answer.
    pub(super) fn update_window(
        &mut self,
        session: &Session,
        sub: &str,
        engine: &Engine,
        counted: bool,
    ) -> Option<Value> {
        let value = self
            .last
            .as_mut()
            .filter(|v| counted || v["supported"] == true)?;
        let lookup = if counted {
            &self.positions
        } else {
            &self.prior
        };
        session
            .window_fields(sub, lookup, engine, value)
            .then(|| value.clone())
    }

    pub(super) fn rebuild(&mut self, mut next: Self) -> Self {
        next.done = !next.supported;
        next.last = self.last.take();
        if next.horizon > self.horizon {
            if next
                .last
                .as_ref()
                .is_some_and(|last| last["supported"] == true)
            {
                next.last = Some(json!({"supported":true,"newest":0,"oldest":0,"months":[]}));
            }
        } else if self.done {
            next.previous = std::mem::take(&mut self.keys);
            next.prior = std::mem::take(&mut self.positions);
        } else {
            next.previous = std::mem::take(&mut self.previous);
            next.prior = std::mem::take(&mut self.prior);
        }
        next
    }
}

impl Session {
    /// A visible index can need more slices after a query, cache or coverage change.
    pub fn timeline_pending(&self, e: &Engine) -> bool {
        self.queries.keys().any(|sub| {
            self.timeline_visible
                .as_ref()
                .is_none_or(|visible| visible.contains(sub))
                && self.timelines.get(sub).is_none_or(|index| {
                    !index.done
                        || index.revision != e.store.revision()
                        || index.horizon != self.history_horizon(sub, e)
                })
        })
    }
}
