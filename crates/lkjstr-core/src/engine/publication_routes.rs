//! Build explicit publication inputs from verified lists and retained provenance.
use super::{
    Engine,
    publication_plan::{self, PublicationInput},
};
use lkjstr_protocol::NostrEvent;
impl Engine {
    pub(super) fn publication_routes(
        &self,
        event: &NostrEvent,
    ) -> Vec<publication_plan::Destination> {
        self.plan_publication(event).0
    }

    pub(super) fn plan_publication(
        &self,
        event: &NostrEvent,
    ) -> (
        Vec<publication_plan::Destination>,
        Option<String>,
        Vec<String>,
    ) {
        let mut own: Vec<String> = self
            .account_relays(&event.pubkey)
            .map(|(_, rs)| {
                rs.into_iter()
                    .filter(|r| r.write)
                    .map(|r| r.url)
                    .take(64)
                    .collect()
            })
            .unwrap_or_else(|| {
                self.network
                    .known
                    .values()
                    .filter(|r| r.write)
                    .take(64)
                    .map(|r| r.url.clone())
                    .collect()
            });
        if event.kind == 10002 {
            // Publish a relay-list transition to the new and previous outboxes.
            // New routes have priority; old routes still carry cap explanations.
            let next = event
                .tags
                .iter()
                .filter_map(|tag| {
                    if tag.first().is_none_or(|k| k != "r")
                        || !matches!(tag.get(2).map(String::as_str), None | Some("write"))
                    {
                        return None;
                    }
                    super::settings::strict_relay(tag.get(1)?)
                })
                .take(64)
                .collect::<Vec<_>>();
            own = next.into_iter().chain(own).collect();
        }
        let mut input = PublicationInput {
            own,
            deletion: event.kind == 5,
            ..Default::default()
        };
        let (author_list, default_routes) = if event.kind == 1 {
            self.note_write_routes(&event.pubkey, &mut input)
        } else {
            (None, Vec::new())
        };
        // People-list tags describe stored lists, not message recipients.
        for person in super::publication_discovery::recipients(event) {
            input.inboxes.push(
                self.account_relays(&person)
                    .map(|(_, rs)| {
                        rs.into_iter()
                            .filter(|r| r.read)
                            .take(64)
                            .map(|r| r.url)
                            .collect()
                    })
                    .unwrap_or_default(),
            );
        }
        if matches!(event.kind, 1 | 5 | 6 | 7 | 16 | 41 | 42) {
            for tag in event
                .tags
                .iter()
                .filter(|t| t.first().is_some_and(|k| k == "e"))
            {
                let Some(id) = tag.get(1) else {
                    continue;
                };
                if event.kind == 5 {
                    input.context.extend(self.network.published_routes(id));
                }
                input.context.extend(self.store.seen_on(id).iter().cloned());
                // Explicit signed references can also carry a relay hint.
                if let Some(hint) = tag.get(2) {
                    input.context.push(hint.clone());
                }
                if input.context.len() >= 64 {
                    break;
                }
            }
        }
        input.context.truncate(64);
        (publication_plan::plan(input), author_list, default_routes)
    }
}
