use super::{Effects, State};
impl State {
    pub fn cancelled_invoices(&mut self) -> Vec<u64> {
        for token in self.jobs.cancelled() {
            self.pending_invoices.remove(&token);
            if self.running_invoices.remove(&token) {
                self.cancel_invoices.insert(token);
            }
        }
        std::mem::take(&mut self.cancel_invoices)
            .into_iter()
            .collect()
    }
    pub fn effects(&mut self) -> Effects {
        let abort_invoices = self.cancelled_invoices();
        let providers: Vec<_> = std::mem::take(&mut self.pending_providers)
            .into_values()
            .collect();
        self.running_providers
            .extend(providers.iter().map(|j| j.token));
        let invoices: Vec<_> = std::mem::take(&mut self.pending_invoices)
            .into_values()
            .collect();
        self.running_invoices
            .extend(invoices.iter().map(|j| j.token));
        Effects {
            providers,
            invoices,
            abort_providers: std::mem::take(&mut self.cancel_providers)
                .into_iter()
                .collect(),
            abort_invoices,
        }
    }
}
