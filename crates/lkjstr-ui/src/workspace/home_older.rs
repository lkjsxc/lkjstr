use crate::workspace::{
    feed_footer_row::plain_footer,
    feed_footer_text::{FooterAuthLabel, footer_state_text},
    home_provider::{HomeFeedLease, HomeFeedProvider},
};
use leptos::prelude::*;
use lkjstr_app::{FEED_LOAD_OLDER_COMMAND, FeedFooterRow, HomeFeedView};
use std::sync::{Arc, Mutex};

#[derive(Default)]
struct LoadState {
    lease: Option<HomeFeedLease>,
    busy: bool,
    closed: bool,
}

#[derive(Clone)]
pub(super) struct HomeOlderLoader {
    owner: String,
    provider: HomeFeedProvider,
    complete: Callback<HomeFeedView>,
    state: Arc<Mutex<LoadState>>,
    loading: RwSignal<bool>,
}

impl HomeOlderLoader {
    pub(super) fn new(
        owner: String,
        provider: HomeFeedProvider,
        complete: Callback<HomeFeedView>,
    ) -> Self {
        Self {
            owner,
            provider,
            complete,
            state: Arc::default(),
            loading: RwSignal::new(false),
        }
    }

    fn request(&self) {
        {
            let Ok(mut state) = self.state.lock() else {
                return;
            };
            if state.closed || state.busy {
                return;
            }
            state.busy = true;
        }
        let _ = self.loading.try_set(true);
        let Some(lease) = self.provider.load_older(self.owner.clone(), self.complete) else {
            if let Ok(mut state) = self.state.lock() {
                state.busy = false;
            }
            let _ = self.loading.try_set(false);
            return;
        };
        let weak = Arc::downgrade(&self.state);
        let loading = self.loading;
        lease.on_release(move || {
            if let Some(state) = weak.upgrade()
                && let Ok(mut state) = state.lock()
            {
                state.busy = false;
                state.lease = None;
            }
            let _ = loading.try_set(false);
        });
        let remembered = match self.state.lock() {
            Ok(mut state) if !state.closed && state.busy && !lease.is_released() => {
                state.lease = Some(lease.clone());
                true
            }
            _ => false,
        };
        if !remembered {
            lease.release();
        }
    }

    pub(super) fn release(&self) {
        let lease = match self.state.lock() {
            Ok(mut state) => {
                state.closed = true;
                state.busy = false;
                state.lease.take()
            }
            Err(_) => None,
        };
        if let Some(lease) = lease {
            lease.release();
        }
        let _ = self.loading.try_set(false);
    }
}

pub(super) fn footer_row(row: FeedFooterRow, loader: Option<HomeOlderLoader>) -> impl IntoView {
    let text = footer_state_text(row.state, FooterAuthLabel::Account);
    let pending = loader
        .as_ref()
        .is_some_and(|loader| loader.loading.get_untracked());
    if (pending || row.command.as_deref() == Some(FEED_LOAD_OLDER_COMMAND))
        && let Some(loader) = loader
    {
        let loading = loader.loading;
        return view! {
            <footer class="lkjstr-feed-footer" data-row-id=row.row_id>
                <span>{text}</span>
                <button type="button" data-testid="home-load-older"
                    disabled=move || loading.get()
                    on:click=move |_| loader.request()>
                    {move || if loading.get() { "Loading older…" } else { "Load older" }}
                </button>
            </footer>
        }
        .into_any();
    }
    plain_footer(row.row_id, text).into_any()
}

#[cfg(test)]
#[path = "home_older_tests.rs"]
mod tests;
