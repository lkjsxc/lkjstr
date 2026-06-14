use leptos::prelude::*;
use lkjstr_app::{FolloweesDiagnostic, FolloweesRow};

use crate::workspace::followees_actions::FolloweesActions;

pub(crate) fn followee_row(row: FolloweesRow, actions: FolloweesActions) -> impl IntoView {
    let pubkey = row.pubkey.clone();
    let label = row
        .petname
        .as_deref()
        .filter(|item| !item.trim().is_empty())
        .map(str::to_owned)
        .unwrap_or_else(|| compact_pubkey(&pubkey));
    let petname = row
        .petname
        .filter(|item| !item.trim().is_empty())
        .unwrap_or_else(|| "No petname".to_owned());
    let relay = row.relay.unwrap_or_else(|| "No relay hint".to_owned());
    view! {
        <article class="lkjstr-feed-row profile" data-row-id=row.row_id>
            <strong>{label}</strong>
            <p>{petname}</p>
            <small>{relay}</small>
            {followee_actions(pubkey, actions)}
        </article>
    }
}

pub(crate) fn diagnostic_row(row: FolloweesDiagnostic) -> impl IntoView {
    let relay = row.relay.unwrap_or_else(|| "selected relay".to_owned());
    let retry = if row.retry_available {
        "Retry available"
    } else {
        "Retry unavailable"
    };
    view! {
        <article class="lkjstr-feed-row diagnostic" data-row-id=row.row_id>
            <strong>{retry}</strong>
            <p>{row.message}</p>
            <small>{relay}</small>
        </article>
    }
}

fn followee_actions(pubkey: String, actions: FolloweesActions) -> impl IntoView {
    view! {
        <div class="lkjstr-feed-actions">
            {action_button(pubkey.clone(), actions.open_profile, "followees-open-profile", "Profile")}
            {action_button(
                pubkey.clone(),
                actions.open_user_timeline,
                "followees-open-user-timeline",
                "Timeline",
            )}
            {action_button(pubkey, actions.copy_npub, "followees-copy-npub", "Copy npub")}
        </div>
    }
}

fn action_button(
    pubkey: String,
    action: Option<Callback<String>>,
    test_id: &'static str,
    label: &'static str,
) -> impl IntoView {
    action.map(|action| {
        let run = move |_| action.run(pubkey.clone());
        view! {
            <button type="button" data-testid=test_id on:click=run>
                {label}
            </button>
        }
    })
}

fn compact_pubkey(pubkey: &str) -> String {
    let chars = pubkey.chars().collect::<Vec<_>>();
    if chars.len() <= 16 {
        return pubkey.to_owned();
    }
    let prefix = chars.iter().take(8).collect::<String>();
    let suffix = chars
        .iter()
        .skip(chars.len().saturating_sub(8))
        .collect::<String>();
    format!("{prefix}...{suffix}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compact_pubkey_keeps_both_ends() {
        assert_eq!(compact_pubkey(&"a".repeat(64)), "aaaaaaaa...aaaaaaaa");
    }
}
