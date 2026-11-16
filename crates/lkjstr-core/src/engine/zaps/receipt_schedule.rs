//! Current targets own validation slices; an explicit query gets the next slot.
use super::*;
impl Receipts {
    pub fn advance_selected(
        &mut self,
        store: &Store,
        providers: &Providers,
        demand: &[Target],
        urgent: &[Target],
        now: u64,
        budget: usize,
    ) {
        let wanted: BTreeSet<_> = demand
            .iter()
            .take(super::super::state::MAX_TARGETS)
            .cloned()
            .collect();
        let urgent: BTreeSet<_> = urgent
            .iter()
            .filter(|t| wanted.contains(*t))
            .cloned()
            .collect();
        for slot in 0..budget.min(4) {
            let first = (slot == 0)
                .then(|| self.pick(&urgent, self.last_urgent.as_ref()))
                .flatten();
            let Some((target, id)) =
                first.or_else(|| self.pick(&wanted, self.last_target.as_ref()))
            else {
                break;
            };
            self.last_target = Some(target.clone());
            if urgent.contains(&target) {
                self.last_urgent = Some(target);
            }
            self.validate_id(store, providers, &id, now);
        }
    }
    fn pick(&self, targets: &BTreeSet<Target>, after: Option<&Target>) -> Option<(Target, String)> {
        let later = targets
            .iter()
            .filter(|t| after.is_none_or(|last| *t > last));
        let earlier = targets
            .iter()
            .filter(|t| after.is_some_and(|last| *t <= last));
        later.chain(earlier).find_map(|target| {
            let first = self.index.get(target)?.queued.first()?;
            Some((target.clone(), self.queue.get(first)?.clone()))
        })
    }
}
