//! Publishing: sign, show locally at once (optimistic), send to the outbox
//! relays plus the inboxes of people tagged, and track each relay's answer.

use leptos::prelude::Update;
use lkjstr_protocol::{
    ClientMessage, NostrEvent, UnsignedNostrEvent, encode_client_message, tags::tag_values,
};
use serde_json::json;

use super::{App, Rt};
use crate::host::{after, now_ms, now_secs};

/// Recent publishes shown in the UI.
const MAX_PUBLISHES: usize = 20;
/// Relays one event is sent to.
const MAX_TARGETS: usize = 8;
const OK_TIMEOUT_MS: u64 = 10_000;

#[derive(Clone, Debug, PartialEq)]
pub enum PubState {
    Sending,
    Accepted,
    Rejected(String),
}

#[derive(Clone, Debug, PartialEq)]
pub struct Publish {
    pub event: NostrEvent,
    pub relays: Vec<(String, PubState)>,
    pub started_ms: u64,
}

impl Publish {
    pub fn accepted(&self) -> usize {
        self.relays
            .iter()
            .filter(|(_, s)| *s == PubState::Accepted)
            .count()
    }

    pub fn pending(&self) -> usize {
        self.relays
            .iter()
            .filter(|(_, s)| *s == PubState::Sending)
            .count()
    }
}

impl Rt {
    fn targets(&self, event: &NostrEvent) -> Vec<String> {
        let mut out: Vec<String> = self
            .store
            .relay_list(&event.pubkey)
            .unwrap_or_default()
            .into_iter()
            .filter(|(_, _, write)| *write)
            .map(|(url, _, _)| url)
            .collect();
        if out.is_empty() {
            out = self
                .scores
                .rank(&self.defaults.read, now_ms())
                .into_iter()
                .take(4)
                .collect();
        }
        for pubkey in tag_values(event, "p").into_iter().take(4) {
            let inbox = self.store.relay_list(&pubkey).unwrap_or_default();
            let urls: Vec<String> = inbox.into_iter().filter(|r| r.1).map(|r| r.0).collect();
            out.extend(self.scores.rank(&urls, now_ms()).into_iter().take(2));
        }
        let mut seen = Vec::new();
        out.retain(|url| {
            !seen.contains(url) && {
                seen.push(url.clone());
                true
            }
        });
        out.truncate(MAX_TARGETS);
        out
    }

    fn broadcast(&mut self, event: NostrEvent) {
        self.accept(event.clone(), "");
        let targets = self.targets(&event);
        if let Ok(text) = encode_client_message(&ClientMessage::Event(event.clone())) {
            for relay in &targets {
                self.send_when_open(relay, text.clone());
            }
        }
        let relays = targets
            .into_iter()
            .map(|url| (url, PubState::Sending))
            .collect();
        self.publishes.push_front(Publish {
            event,
            relays,
            started_ms: now_ms(),
        });
        self.publishes.truncate(MAX_PUBLISHES);
    }

    pub(super) fn on_ok(&mut self, relay: &str, id: &str, accepted: bool, message: String) {
        for publish in self.publishes.iter_mut().filter(|p| p.event.id == id) {
            for (_, state) in publish.relays.iter_mut().filter(|(url, _)| url == relay) {
                *state = if accepted {
                    PubState::Accepted
                } else {
                    PubState::Rejected(message.clone())
                };
            }
        }
    }

    /// Answers NIP-42 challenges only with a local key (no signer prompts).
    pub(super) fn on_auth(&mut self, relay: &str, challenge: &str) {
        let Some(account) = self.session.active_account().cloned() else {
            return;
        };
        let Some(secret) = self.session.local_secret().map(str::to_owned) else {
            self.scores.entry(relay).auth_required = true;
            return;
        };
        let template = lkjstr_protocol::EventTemplate {
            pubkey: Some(account.pubkey),
            created_at: now_secs(),
            kind: 22242,
            tags: vec![
                vec!["relay".into(), relay.into()],
                vec!["challenge".into(), challenge.into()],
            ],
            content: String::new(),
        };
        let Some(key) = lkjstr_protocol::parse_secret_key_hex(&secret) else {
            return;
        };
        if let Ok(event) = lkjstr_protocol::finalize_event(&template, &key) {
            if let Some(conn) = self.net.conns.get_mut(relay) {
                conn.auth.pending = Some(event.id.clone());
                conn.auth_until_ms = now_ms() + OK_TIMEOUT_MS;
            }
            self.send_raw(relay, &json!(["AUTH", event]).to_string());
            if let Some(app) = self.app() {
                after(OK_TIMEOUT_MS + 1, move || {
                    app.update(|rt| rt.schedule_replan(1))
                });
            }
        }
    }
}

impl App {
    /// Signs and publishes; the event shows locally before relays answer.
    pub async fn publish(
        &self,
        kind: u64,
        content: String,
        tags: Vec<Vec<String>>,
    ) -> Result<String, String> {
        let pubkey = self
            .with(|rt| rt.session.active.clone())
            .ok_or("Choose an account first.")?;
        let unsigned = UnsignedNostrEvent {
            pubkey,
            created_at: now_secs(),
            kind,
            tags,
            content,
        };
        let event = self.sign(unsigned).await?;
        let id = event.id.clone();
        self.update(|rt| rt.broadcast(event));
        self.bump_rev();
        self.session_rev.update(|rev| *rev += 1);
        let app = *self;
        let watched = id.clone();
        after(OK_TIMEOUT_MS, move || {
            app.update(|rt| {
                for publish in rt.publishes.iter_mut().filter(|p| p.event.id == watched) {
                    for (_, state) in publish
                        .relays
                        .iter_mut()
                        .filter(|(_, s)| *s == PubState::Sending)
                    {
                        *state = PubState::Rejected("no answer".into());
                    }
                }
            });
            app.session_rev.update(|rev| *rev += 1);
        });
        Ok(id)
    }
}
