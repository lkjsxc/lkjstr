//! Keep the previous map while its replacement is built, unless coverage shrank.
use super::{Index, json};

impl Index {
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
