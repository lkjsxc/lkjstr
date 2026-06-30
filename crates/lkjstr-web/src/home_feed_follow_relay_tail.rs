use lkjstr_app::{
    FeedFragmentConfig, HomeFeedSourceState, HomeFeedView, HomeFeedViewInput,
    HomeFollowState, ProtectedAccountAvailability, build_home_feed_view, summarize_follow_list,
};
use lkjstr_protocol::{ClientMessage, encode_client_message};
use lkjstr_relays::{
    ProgressiveReadEvidence, ProgressiveReadSnapshot, ProgressiveReadStatus, progressive_read_snapshot,
    reduce_progressive_read,
};

use crate::{
    home_feed_follow_relay::HomeFollowRead,
    home_feed_host::{PAGE_SIZE, diagnostic},
    home_feed_relay_input::HomeRelayReadInput,
    home_feed_relay_status::{RelayEnd, relay_status, relay_terminal},
    host_status::browser_now_ms,
};

impl HomeFollowRead {
    pub(super) fn apply_status(&self, relay: &str, end: RelayEnd) {
        self.reduce(ProgressiveReadEvidence::RelayStatuses(vec![relay_status(
            relay,
            end,
            self.relay_event_count(relay),
        )]));
    }

    pub(super) fn reduce(&self, evidence: ProgressiveReadEvidence) {
        let next = reduce_progressive_read(self.state.borrow().clone(), evidence);
        self.state.replace(next);
    }

    pub(super) fn publish_loaded(&self) {
        let Some(event) = self.latest.borrow().clone() else {
            return;
        };
        let follow_pubkeys = summarize_follow_list(&event)
            .entries
            .into_iter()
            .map(|entry| entry.pubkey)
            .collect::<Vec<_>>();
        (self.complete)(self.model(HomeFollowState::Loaded {
            follow_pubkeys: follow_pubkeys.clone(),
        }));
        (self.follow_loaded)(HomeRelayReadInput {
            owner: self.input.owner.clone(),
            active_pubkey: self.input.active_pubkey.clone(),
            follow_pubkeys,
            selected_relays: self.input.selected_relays.clone(),
            cache_window: self.input.cache_window.clone(),
            geometry_models: self.input.geometry_models.clone(),
            diagnostics: self.input.diagnostics.clone(),
            now_sec: self.input.now_sec,
        });
    }

    pub(super) fn finish_relay(&self, relay: &str, end: RelayEnd) {
        if self.done.get() || self.relay_done(relay) {
            return;
        }
        self.apply_status(relay, end);
        if self.all_relays_done() {
            self.done.set(true);
            self.reduce(ProgressiveReadEvidence::Finalize(Vec::new()));
            self.publish_final();
            self.close_all();
        }
    }

    pub(super) fn timeout(&self) {
        if self.done.replace(true) {
            return;
        }
        self.reduce(ProgressiveReadEvidence::Timeout);
        self.publish_final();
        self.close_all();
    }

    pub(super) fn cancel(&self) {
        if self.done.replace(true) {
            return;
        }
        self.reduce(ProgressiveReadEvidence::Cancel);
        self.close_all();
    }

    fn publish_final(&self) {
        if self.latest.borrow().is_some() {
            return;
        }
        let snapshot = progressive_read_snapshot(&self.state.borrow(), "follow-final", browser_now_ms());
        (self.complete)(self.model(final_follow_state(&snapshot)));
    }

    fn model(&self, follow_state: HomeFollowState) -> HomeFeedView {
        build_home_feed_view(HomeFeedViewInput {
            owner: self.input.owner.clone(),
            account: ProtectedAccountAvailability::selected(self.input.active_pubkey.clone()),
            follow_state,
            source_state: HomeFeedSourceState::Pending,
            selected_relays: self.input.selected_relays.clone(),
            disabled_relays: Vec::new(),
            author_routes: Vec::new(),
            visibility: lkjstr_relays::DemandVisibility::Visible,
            since: Some(self.input.now_sec.saturating_sub(30)),
            now_sec: self.input.now_sec,
            page_size: PAGE_SIZE,
            window: self.input.cache_window.clone(),
            width_px: 680,
            font_scale: 1.0,
            geometry_models: self.input.geometry_models.clone(),
            fragment_config: FeedFragmentConfig::default(),
            diagnostics: self.relay_diagnostics(),
        })
    }

    fn relay_diagnostics(&self) -> Vec<lkjstr_app::HomeFeedDiagnosticInput> {
        let mut out = self.input.diagnostics.clone();
        let snapshot = progressive_read_snapshot(&self.state.borrow(), "follow", browser_now_ms());
        out.extend(snapshot.relays.iter().filter_map(|relay| {
            relay.reason.as_ref().map(|reason| {
                diagnostic(
                    &format!("follow-relay-{}", relay.relay),
                    &format!("{}: {reason}", relay.relay),
                )
            })
        }));
        out
    }

    fn close_all(&self) {
        if let Some(timer) = self.timeout.borrow_mut().take() {
            timer.clear();
        }
        let close = encode_client_message(&ClientMessage::Close(self.sub_id.clone())).ok();
        for (_relay, mut socket) in std::mem::take(&mut *self.sockets.borrow_mut()) {
            if let Some(frame) = &close {
                let _result = socket.send_text(frame);
            }
            let _result = socket.close();
        }
    }

    fn relay_event_count(&self, relay: &str) -> u64 {
        self.latest_relay
            .borrow()
            .as_ref()
            .is_some_and(|latest_relay| latest_relay == relay) as u64
    }

    fn relay_done(&self, relay: &str) -> bool {
        self.state
            .borrow()
            .relay_states
            .get(relay)
            .is_some_and(|snapshot| relay_terminal(snapshot.state))
    }

    fn all_relays_done(&self) -> bool {
        self.state
            .borrow()
            .relay_states
            .values()
            .all(|snapshot| relay_terminal(snapshot.state))
    }
}

fn final_follow_state(snapshot: &ProgressiveReadSnapshot) -> HomeFollowState {
    if snapshot.status == ProgressiveReadStatus::Complete {
        return HomeFollowState::MissingComplete;
    }
    HomeFollowState::Unavailable {
        reason: snapshot.reason.clone(),
        retry_available: true,
    }
}
