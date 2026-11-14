//! Relay messages and socket lifecycle: EVENT/EOSE/CLOSED/OK/NOTICE/AUTH,
//! connection loss with backoff, and per-relay statistics.

use leptos::prelude::Update;
use lkjstr_protocol::{ClientMessage, RelayMessage, parse_relay_message};

use super::net::{Sub, SubState};
use super::{App, Rt};
use crate::host::socket::SocketEvent;
use crate::host::{after, now_ms, random};

impl Rt {
    fn sub_by_id(&mut self, relay: &str, sub_id: &str) -> Option<&mut Sub> {
        self.net
            .subs
            .values_mut()
            .find(|s| s.planned.relay == relay && s.sub_id == sub_id)
    }

    pub(super) fn on_socket(&mut self, relay: &str, event: SocketEvent) {
        match event {
            SocketEvent::Open => {
                self.scores.entry(relay).on_connect();
                let outbox = match self.net.conns.get_mut(relay) {
                    Some(conn) => {
                        conn.open = true;
                        conn.error = None;
                        std::mem::take(&mut conn.outbox)
                    }
                    None => Vec::new(),
                };
                for text in outbox {
                    self.send_raw(relay, &text);
                }
                self.pump(relay);
            }
            SocketEvent::Closed(reason) => {
                self.net.conns.remove(relay);
                let backoff = {
                    let stats = self.scores.entry(relay);
                    stats.on_failure(now_ms(), random());
                    stats.backoff_until_ms.saturating_sub(now_ms())
                };
                self.net.conns.entry(relay.to_owned()).or_default().error = Some(reason.clone());
                for sub in self
                    .net
                    .subs
                    .values_mut()
                    .filter(|s| s.planned.relay == relay)
                {
                    if sub.state != SubState::Done {
                        sub.state = SubState::Failed(reason.clone());
                    }
                }
                self.schedule_replan(50);
                if let Some(app) = self.app() {
                    after(backoff + 100, move || app.update(|rt| rt.retry_failed()));
                }
            }
            SocketEvent::Message(text) => {
                if let Ok(message) = parse_relay_message(&text, None) {
                    self.on_message(relay, message);
                }
            }
        }
    }

    /// After a backoff, failed requests are planned afresh.
    fn retry_failed(&mut self) {
        self.net
            .subs
            .retain(|_, s| !matches!(s.state, SubState::Failed(_)));
        self.schedule_replan(10);
    }

    fn on_message(&mut self, relay: &str, message: RelayMessage) {
        match message {
            RelayMessage::Event {
                subscription_id,
                event,
            } => {
                if let Some(sub) = self.sub_by_id(relay, &subscription_id) {
                    sub.events += 1;
                }
                self.enqueue(relay, event);
            }
            RelayMessage::Eose(sub_id) => self.on_eose(relay, &sub_id),
            RelayMessage::Closed {
                subscription_id,
                message,
            } => {
                if let Some(sub) = self.sub_by_id(relay, &subscription_id) {
                    sub.state = SubState::Failed(message.clone());
                }
                let stats = self.scores.entry(relay);
                stats.refused += 1;
                if message.starts_with("auth-required") {
                    stats.auth_required = true;
                }
                self.pump(relay);
                self.schedule_replan(200);
            }
            RelayMessage::Ok {
                event_id,
                accepted,
                message,
            } => {
                let auth = self.net.conns.get_mut(relay).is_some_and(|conn| {
                    conn.auth
                        .acknowledge(&event_id, accepted, relay, &mut self.net.subs)
                });
                if auth && accepted {
                    self.scores.entry(relay).auth_required = false;
                    self.pump(relay);
                } else if !auth {
                    self.on_ok(relay, &event_id, accepted, message);
                }
                self.schedule_replan(200);
            }
            RelayMessage::Notice(text) => {
                if let Some(conn) = self.net.conns.get_mut(relay) {
                    conn.notice = Some(text.chars().take(200).collect());
                }
            }
            RelayMessage::Auth(challenge) => self.on_auth(relay, &challenge),
        }
    }

    fn on_eose(&mut self, relay: &str, sub_id: &str) {
        let Some(sub) = self.sub_by_id(relay, sub_id) else {
            return;
        };
        let latency = now_ms().saturating_sub(sub.sent_ms) as f64;
        let first = sub.state == SubState::Waiting;
        let close = !sub.planned.live;
        sub.state = if close {
            SubState::Done
        } else {
            SubState::Live
        };
        if first {
            self.scores.entry(relay).on_answer(latency);
        }
        if close {
            self.send(relay, &ClientMessage::Close(sub_id.to_owned()));
        }
        self.pump(relay);
        self.schedule_replan(200);
    }
}

impl App {
    /// Socket callback entry. Events only bump the store revision (after
    /// ingest); every other message may change visible status.
    pub(crate) fn on_socket(&self, relay: &str, event: SocketEvent) {
        let quiet = matches!(&event, SocketEvent::Message(text) if text.starts_with("[\"EVENT\""));
        let publish = matches!(&event, SocketEvent::Message(text) if text.starts_with("[\"OK\""));
        self.update(|rt| rt.on_socket(relay, event));
        if !quiet {
            self.net_rev.update(|rev| *rev += 1);
        }
        if publish {
            self.session_rev.update(|rev| *rev += 1);
        }
    }
}
