use leptos::prelude::*;
use lkjstr_app::feed::FeedEventLink;

#[derive(Clone, Debug, Eq, PartialEq)]
struct FeedEventLinkAttrs {
    href: String,
    text: String,
    target: &'static str,
    rel: &'static str,
}

pub(super) fn event_link(link: FeedEventLink) -> impl IntoView {
    let attrs = event_link_attrs(&link);
    view! {
        <a
            class="event-link"
            href=attrs.href
            target=attrs.target
            rel=attrs.rel
        >
            {attrs.text}
        </a>
    }
}

fn event_link_attrs(link: &FeedEventLink) -> FeedEventLinkAttrs {
    FeedEventLinkAttrs {
        href: link.url.clone(),
        text: link.text.clone(),
        target: "_blank",
        rel: "noopener noreferrer",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn event_link_attrs_keep_safe_external_policy() {
        let attrs = event_link_attrs(&FeedEventLink {
            url: "https://example.com/page".to_owned(),
            text: "https://example.com/page".to_owned(),
        });

        assert_eq!(
            attrs,
            FeedEventLinkAttrs {
                href: "https://example.com/page".to_owned(),
                text: "https://example.com/page".to_owned(),
                target: "_blank",
                rel: "noopener noreferrer",
            }
        );
    }
}
