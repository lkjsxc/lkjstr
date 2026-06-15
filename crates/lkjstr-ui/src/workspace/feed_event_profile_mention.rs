use leptos::prelude::*;
use lkjstr_app::feed::FeedEventProfileMention;

#[derive(Clone, Debug, Eq, PartialEq)]
struct ProfileMentionAttrs {
    class_name: &'static str,
    pubkey: String,
    relays: String,
    title: String,
    text: String,
}

pub(super) fn profile_mention(mention: FeedEventProfileMention) -> impl IntoView {
    let attrs = profile_mention_attrs(&mention);
    view! {
        <span
            class=attrs.class_name
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
        class_name: "content-token content-mention-token",
        pubkey: mention.pubkey.clone(),
        relays: mention.relays.join(" "),
        title: mention.raw_text.clone(),
        text: mention.raw_text.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_mention_attrs_keep_real_identity_only() {
        let attrs = profile_mention_attrs(&FeedEventProfileMention {
            pubkey: "a".repeat(64),
            relays: vec!["wss://relay.example".to_owned()],
            raw_text: "nostr:npub1example".to_owned(),
        });

        assert_eq!(
            attrs,
            ProfileMentionAttrs {
                class_name: "content-token content-mention-token",
                pubkey: "a".repeat(64),
                relays: "wss://relay.example".to_owned(),
                title: "nostr:npub1example".to_owned(),
                text: "nostr:npub1example".to_owned(),
            }
        );
    }
}
