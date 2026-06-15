use leptos::prelude::*;
use lkjstr_app::feed::FeedEventLink;

#[derive(Clone, Debug, Eq, PartialEq)]
struct FeedEventLinkAttrs {
    row_key: String,
    item_index: String,
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
            data-row-key=attrs.row_key
            data-item-index=attrs.item_index
        >
            {attrs.text}
        </a>
    }
}

fn event_link_attrs(link: &FeedEventLink) -> FeedEventLinkAttrs {
    FeedEventLinkAttrs {
        row_key: link.row_key.clone(),
        item_index: link.item_index.to_string(),
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
            row_key: "event:event:shape:shape:kind:event-link:index:0".to_owned(),
            item_index: 0,
            url: "https://example.com/page".to_owned(),
            text: "https://example.com/page".to_owned(),
        });

        assert_eq!(
            attrs,
            FeedEventLinkAttrs {
                row_key: "event:event:shape:shape:kind:event-link:index:0".to_owned(),
                item_index: "0".to_owned(),
                href: "https://example.com/page".to_owned(),
                text: "https://example.com/page".to_owned(),
                target: "_blank",
                rel: "noopener noreferrer",
            }
        );
    }
}
