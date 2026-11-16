use super::super::Failure;
use super::Jobs;
use crate::store::Store;
impl Jobs {
    /// A validated HTTP response may sit in the terminal queue while the page is
    /// frozen. Delivery still belongs to the current request and recipient binding.
    pub fn revalidate_outcomes(&mut self, store: &Store, now: u64) {
        for completed in self.outcomes.values_mut() {
            let Ok(batch) = &completed.result else {
                continue;
            };
            let error = if batch.invoices.iter().any(|i| i.expires_at <= now) {
                Some(Failure::Expired)
            } else if now >= completed.deadline {
                Some(Failure::Network)
            } else {
                completed
                    .requests
                    .iter()
                    .find_map(|request| request.current(store, now).err())
            };
            if let Some(error) = error {
                completed.fail(error);
            }
        }
    }
}
