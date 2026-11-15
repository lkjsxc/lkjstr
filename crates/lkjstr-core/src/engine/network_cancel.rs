//! A deletion supersedes outstanding sends and inbox discovery for its target.
use super::*;
use crate::engine::protocol::Delivery;
impl Network {
    pub(in crate::engine) fn cancel_publication(&mut self, id: &str) {
        let Some(p) = self.publications.remove(id) else {
            return;
        };
        let deliveries: Vec<_> = p
            .deliveries
            .into_iter()
            .map(|(relay, state)| {
                let cancelled = state == "pending";
                Delivery {
                    relay,
                    state: if cancelled { "rejected".into() } else { state },
                    message: cancelled.then(|| "superseded-by-delete".into()),
                }
            })
            .collect();
        self.update_publication(id, &deliveries);
        self.output.push(Output::Delivery {
            req: p.req.clone(),
            deliveries: deliveries.clone(),
        });
        if !p.reported_success {
            self.output.push(Output::Result {
                req: p.req,
                id: Some(id.into()),
                deliveries,
                error: Some("rejected".into()),
            });
        }
    }
}
