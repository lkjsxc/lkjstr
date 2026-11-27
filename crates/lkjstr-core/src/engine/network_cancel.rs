//! A deletion supersedes outstanding sends and inbox discovery for its target.
use super::*;
use crate::engine::protocol::Delivery;
impl Network {
    pub(super) fn cancel_publication_sends(&mut self, id: &str, blocked: impl Fn(&str) -> bool) {
        self.effects.retain(|effect| {
            !matches!(effect, Effect::Send(url, text)
                if blocked(url) && text.starts_with("[\"EVENT\",")
                    && serde_json::from_str::<Value>(text)
                        .is_ok_and(|frame| frame[1]["id"] == id))
        });
    }

    pub(in crate::engine) fn cancel_publication(&mut self, id: &str) {
        self.note_outbox.discard_id(id, self.now);
        if let Some(r) = self.receipts.remove(id) {
            for (url, (wire, _)) in r.checks {
                self.send(&url, json!(["CLOSE", wire]));
            }
        }
        let Some(p) = self.publications.remove(id) else {
            return;
        };
        self.cancel_publication_sends(id, |_| true);
        let mut deliveries: Vec<_> = p
            .deliveries
            .into_iter()
            .map(|(relay, state)| {
                let cancelled = state == "pending";
                let message = if cancelled {
                    None
                } else {
                    p.messages.get(&relay).cloned()
                };
                Delivery {
                    relay,
                    state: if cancelled { "rejected".into() } else { state },
                    message,
                }
            })
            .collect();
        self.update_publication(id, &deliveries);
        deliveries.retain(|d| p.attempted.contains(&d.relay));
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

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cancellation_does_not_present_an_internal_code_as_relay_words() {
        let mut n = Network::default();
        let e = lkjstr_protocol::finalize_event(
            &lkjstr_protocol::EventTemplate {
                pubkey: None,
                created_at: 1,
                kind: 1,
                content: "cancel".into(),
                tags: vec![],
            },
            &lkjstr_protocol::generate_secret_key(),
        )
        .unwrap_or_else(|_| unreachable!());
        n.publish(
            "post".into(),
            e.clone(),
            crate::engine::publication_plan::plan(
                crate::engine::publication_plan::PublicationInput {
                    own: vec!["wss://cancel.test/".into()],
                    ..Default::default()
                },
            ),
            0,
        );
        n.connected("wss://cancel.test/", 1);
        n.drain_output();
        n.cancel_publication(&e.id);
        assert!(!n.drain_effects().iter().any(|effect| matches!(
            effect, Effect::Send(_, frame) if frame.contains(&e.id)
        )));
        assert!(n.drain_output().iter().any(|o| matches!(o, Output::Delivery { deliveries, .. } if deliveries.iter().all(|d| d.message.is_none()))));
    }
}
