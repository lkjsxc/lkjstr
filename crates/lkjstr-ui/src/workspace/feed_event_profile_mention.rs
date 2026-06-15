use leptos::{ev::MouseEvent, prelude::*};
use lkjstr_app::feed::FeedEventProfileMention;

#[derive(Clone, Debug, Eq, PartialEq)]
struct ProfileMentionAttrs {
    row_key: String,
    item_index: String,
    class_name: &'static str,
    pubkey: String,
    relays: String,
    title: String,
    text: String,
}

pub(super) fn profile_mention(
    mention: FeedEventProfileMention,
    open_profile: Option<Callback<String>>,
) -> impl IntoView {
    let attrs = profile_mention_attrs(&mention);
    let action_pubkey = profile_mention_action_pubkey(&mention, open_profile.is_some());
    let Some(open_profile) = open_profile else {
        return profile_mention_span(attrs).into_any();
    };
    let Some(pubkey) = action_pubkey else {
        return profile_mention_span(attrs).into_any();
    };
    let open = move |event: MouseEvent| {
        event.stop_propagation();
        open_profile.run(pubkey.clone());
    };
    view! {
        <button
            type="button"
            class=attrs.class_name
            data-row-key=attrs.row_key
            data-item-index=attrs.item_index
            data-pubkey=attrs.pubkey
            data-relays=attrs.relays
            title=attrs.title
            on:click=open
        >
            {attrs.text}
        </button>
    }
    .into_any()
}

fn profile_mention_span(attrs: ProfileMentionAttrs) -> impl IntoView {
    view! {
        <span
            class=attrs.class_name
            data-row-key=attrs.row_key
            data-item-index=attrs.item_index
            data-pubkey=attrs.pubkey
            data-relays=attrs.relays
            title=attrs.title
        >
            {attrs.text}
        </span>
    }
}

fn profile_mention_attrs(mention: &FeedEventProfileMention) -> ProfileMentionAttrs {
    ProfileMentionAttrs {
        row_key: mention.row_key.clone(),
        item_index: mention.item_index.to_string(),
        class_name: "content-token content-mention-token",
        pubkey: mention.pubkey.clone(),
        relays: mention.relays.join(" "),
        title: mention.raw_text.clone(),
        text: mention.raw_text.clone(),
    }
}

fn profile_mention_action_pubkey(
    mention: &FeedEventProfileMention,
    can_open: bool,
) -> Option<String> {
    can_open.then(|| mention.pubkey.clone())
}

#[cfg(test)]
fn profile_mention_element(can_open: bool) -> &'static str {
    if can_open { "button" } else { "span" }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_mention_attrs_keep_real_identity_only() {
        let mention = FeedEventProfileMention {
            row_key: "event:event:shape:shape:kind:event-profile-mention:index:0".to_owned(),
            item_index: 0,
            pubkey: "a".repeat(64),
            relays: vec!["wss://relay.example".to_owned()],
            raw_text: "nostr:npub1example".to_owned(),
        };
        let attrs = profile_mention_attrs(&mention);

        assert_eq!(
            attrs,
            ProfileMentionAttrs {
                row_key: "event:event:shape:shape:kind:event-profile-mention:index:0".to_owned(),
                item_index: "0".to_owned(),
                class_name: "content-token content-mention-token",
                pubkey: "a".repeat(64),
                relays: "wss://relay.example".to_owned(),
                title: "nostr:npub1example".to_owned(),
                text: "nostr:npub1example".to_owned(),
            }
        );
    }

    #[test]
    fn profile_mention_button_policy_follows_real_opener() {
        assert_eq!(profile_mention_element(false), "span");
        assert_eq!(profile_mention_element(true), "button");
    }

    #[test]
    fn profile_mention_action_uses_row_pubkey_only_with_opener() {
        let mention = FeedEventProfileMention {
            row_key: "event:event:shape:shape:kind:event-profile-mention:index:0".to_owned(),
            item_index: 0,
            pubkey: "b".repeat(64),
            relays: Vec::new(),
            raw_text: "nostr:npub1example".to_owned(),
        };

        assert_eq!(profile_mention_action_pubkey(&mention, false), None);
        assert_eq!(
            profile_mention_action_pubkey(&mention, true),
            Some("b".repeat(64))
        );
    }
}
