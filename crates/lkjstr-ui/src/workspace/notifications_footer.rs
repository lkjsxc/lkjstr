use leptos::prelude::*;
use lkjstr_app::{FEED_LOAD_OLDER_COMMAND, FeedFooterRow, NotificationsOlderLoadTrigger};

use crate::workspace::feed_footer_text::{FooterAuthLabel, footer_state_text};

pub(super) fn footer_row(
    row: FeedFooterRow,
    older_command: Option<Callback<NotificationsOlderLoadTrigger>>,
) -> impl IntoView {
    let command_ready = row.command.as_deref() == Some(FEED_LOAD_OLDER_COMMAND);
    let row_id = row.row_id;
    let text = footer_state_text(row.state, FooterAuthLabel::Account);
    match (command_ready, older_command) {
        (true, Some(command)) => command_footer(row_id, text, command).into_any(),
        _ => view! {
            <footer class="lkjstr-feed-footer" data-row-id=row_id>
                {text}
            </footer>
        }
        .into_any(),
    }
}

fn command_footer(
    row_id: String,
    text: &'static str,
    command: Callback<NotificationsOlderLoadTrigger>,
) -> impl IntoView {
    let load_older = move |_| command.run(NotificationsOlderLoadTrigger::Explicit);
    view! {
        <footer class="lkjstr-feed-footer" data-row-id=row_id>
            <button type="button" data-testid="notifications-load-older" on:click=load_older>
                {text}
            </button>
        </footer>
    }
}
