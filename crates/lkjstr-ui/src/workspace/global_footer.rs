use leptos::prelude::*;
use lkjstr_app::{FEED_LOAD_OLDER_COMMAND, FeedFooterRow, GlobalOlderLoadTrigger};

use crate::workspace::feed_footer_row::{command_footer, plain_footer};
use crate::workspace::feed_footer_text::{FooterAuthLabel, footer_state_text};

pub(super) fn footer_row(
    row: FeedFooterRow,
    older_command: Option<Callback<GlobalOlderLoadTrigger>>,
) -> impl IntoView {
    let command_ready = row.command.as_deref() == Some(FEED_LOAD_OLDER_COMMAND);
    let row_id = row.row_id;
    let text = footer_state_text(row.state, FooterAuthLabel::Account);
    match (command_ready, older_command) {
        (true, Some(command)) => command_footer(
            row_id,
            text,
            "global-load-older",
            GlobalOlderLoadTrigger::Explicit,
            command,
        )
        .into_any(),
        _ => plain_footer(row_id, text).into_any(),
    }
}
