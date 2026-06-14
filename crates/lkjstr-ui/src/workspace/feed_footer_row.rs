use leptos::prelude::*;
use lkjstr_app::FeedFooterState;

use crate::workspace::feed_footer_text::{FooterAuthLabel, footer_state_text};

pub(crate) fn state_footer(
    row_id: String,
    state: FeedFooterState,
    auth_label: FooterAuthLabel,
) -> impl IntoView {
    plain_footer(row_id, footer_state_text(state, auth_label))
}

pub(crate) fn plain_footer(row_id: String, text: &'static str) -> impl IntoView {
    view! {
        <footer class="lkjstr-feed-footer" data-row-id=row_id>
            {text}
        </footer>
    }
}

pub(crate) fn command_footer<T>(
    row_id: String,
    text: &'static str,
    test_id: &'static str,
    trigger: T,
    command: Callback<T>,
) -> impl IntoView
where
    T: Clone + 'static,
{
    let load_older = move |_| command.run(trigger.clone());
    view! {
        <footer class="lkjstr-feed-footer" data-row-id=row_id>
            <button type="button" data-testid=test_id on:click=load_older>
                {text}
            </button>
        </footer>
    }
}
