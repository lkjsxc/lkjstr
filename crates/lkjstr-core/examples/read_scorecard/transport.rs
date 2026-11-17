//! Discrete transport: exact emitted frames, relay replies and cancellation.
use super::{
    fixture::{Failure, Fixture},
    metrics::Metrics,
};
use lkjstr_core::engine::{Engine, network::Effect};
use lkjstr_protocol::{NostrFilter, parse_filter_value};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};

enum Delivery {
    Connected(String),
    Frame {
        relay: String,
        wire: String,
        text: String,
    },
}
#[derive(Default)]
pub(super) struct Transport {
    pending: BTreeMap<u64, Vec<Delivery>>,
    active: BTreeSet<(String, String)>,
    sockets: BTreeSet<String>,
}
impl Transport {
    fn schedule(&mut self, at: u64, delivery: Delivery) {
        self.pending.entry(at).or_default().push(delivery);
    }
    pub(super) fn effects(
        &mut self,
        engine: &mut Engine,
        fixture: &Fixture,
        metrics: &mut Metrics,
        now: u64,
    ) -> Result<(), Failure> {
        // Follow-up effects are synchronous policy work; delayed responses never run here.
        for _ in 0..32 {
            let effects = engine.network.drain_effects();
            if effects.is_empty() {
                return Ok(());
            }
            for effect in effects {
                match effect {
                    Effect::Inspect(url) => {
                        metrics.inspections += 1;
                        let relay = fixture.relay(&url)?;
                        engine.network.relay_information(
                            &url,
                            &json!({
                                "supported_nips":[1],
                                "limitation":{"max_filters":2,"max_subscriptions":4,
                                    "max_limit":relay.limit}
                            })
                            .to_string(),
                        );
                    }
                    Effect::Connect(url) => {
                        metrics.connect(&url);
                        self.sockets.insert(url.clone());
                        self.schedule(now + 20, Delivery::Connected(url));
                    }
                    Effect::Disconnect(url) => {
                        metrics.disconnect(&url);
                        self.sockets.remove(&url);
                        self.active.retain(|(relay, _)| relay != &url);
                    }
                    Effect::Send(url, text) => {
                        metrics.bytes_out += text.len();
                        let value: Value = serde_json::from_str(&text)?;
                        let wire = value[1].as_str().ok_or("missing wire id")?.to_owned();
                        if value[0] == "CLOSE" {
                            self.active.remove(&(url.clone(), wire.clone()));
                            metrics.close(&url, &wire);
                        } else if value[0] == "REQ" {
                            let filters: Vec<NostrFilter> = value
                                .as_array()
                                .ok_or("request is not an array")?
                                .iter()
                                .skip(2)
                                .map(parse_filter_value)
                                .collect::<Option<_>>()
                                .ok_or("invalid emitted filter")?;
                            metrics.request(&url, &wire, &filters);
                            self.active.insert((url.clone(), wire.clone()));
                            self.answer(fixture, &url, &wire, &filters, now)?;
                        } else {
                            return Err(
                                "fixture permits only REQ/CLOSE; no publication or signing".into(),
                            );
                        }
                    }
                }
            }
        }
        Err("unbounded synchronous network effect cycle".into())
    }
    fn answer(
        &mut self,
        fixture: &Fixture,
        url: &str,
        wire: &str,
        filters: &[NostrFilter],
        now: u64,
    ) -> Result<(), Failure> {
        let relay = fixture.relay(url)?;
        let start = now + relay.latency;
        let frame = |value: Value| Delivery::Frame {
            relay: url.into(),
            wire: wire.into(),
            text: value.to_string(),
        };
        if relay.refuses {
            self.schedule(
                start,
                frame(json!(["CLOSED", wire, "rate-limited: fixture refusal"])),
            );
            return Ok(());
        }
        let answers = fixture.answer(relay, filters);
        for (offset, event) in answers.iter().enumerate() {
            self.schedule(start + offset as u64, frame(json!(["EVENT", wire, event])));
        }
        self.schedule(
            start + answers.len() as u64 + 1,
            frame(json!(["EOSE", wire])),
        );
        Ok(())
    }
    pub(super) fn deliver(
        &mut self,
        engine: &mut Engine,
        fixture: &Fixture,
        metrics: &mut Metrics,
        now: u64,
    ) -> Result<(), Failure> {
        while self
            .pending
            .first_key_value()
            .is_some_and(|(time, _)| *time <= now)
        {
            let Some((_, deliveries)) = self.pending.pop_first() else {
                break;
            };
            for delivery in deliveries {
                match delivery {
                    Delivery::Connected(url) => {
                        if self.sockets.contains(&url) {
                            engine.network.connected(&url, now);
                        }
                    }
                    Delivery::Frame { relay, wire, text } => {
                        if !self.active.contains(&(relay.clone(), wire.clone())) {
                            metrics.cancelled_frames += 1;
                            continue;
                        }
                        let value: Value = serde_json::from_str(&text)?;
                        let accepted = engine.network.message(&relay, &text, now);
                        metrics.delivered(&relay, &wire, &text, &value, accepted.as_ref(), fixture);
                        if let Some(event) = accepted {
                            engine.enqueue(relay.clone(), event);
                        }
                        if value[0] == "CLOSED" {
                            self.active.remove(&(relay, wire));
                        }
                    }
                }
            }
        }
        Ok(())
    }
}
