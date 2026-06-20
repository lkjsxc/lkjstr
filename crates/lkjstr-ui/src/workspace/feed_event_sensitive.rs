use leptos::{ev::MouseEvent, prelude::*};

#[derive(Clone, Debug, Eq, PartialEq)]
struct SensitiveWarningAttrs {
    class_name: &'static str,
    state: &'static str,
    title: &'static str,
    reason: Option<String>,
    button_label: &'static str,
}

pub(super) fn sensitive_warning(reason: Option<String>, revealed: RwSignal<bool>) -> impl IntoView {
    let attrs = sensitive_warning_attrs(reason);
    let reveal = move |event: MouseEvent| {
        if sensitive_reveal_stops_propagation() {
            event.stop_propagation();
        }
        revealed.set(true);
    };
    view! {
        <aside class=attrs.class_name data-sensitive-state=attrs.state>
            <strong>{attrs.title}</strong>
            {warning_reason(attrs.reason)}
            <button type="button" on:click=reveal>{attrs.button_label}</button>
        </aside>
    }
}

fn sensitive_warning_attrs(reason: Option<String>) -> SensitiveWarningAttrs {
    SensitiveWarningAttrs {
        class_name: "content-warning",
        state: "hidden",
        title: "Sensitive content",
        reason,
        button_label: "Reveal",
    }
}

fn warning_reason(reason: Option<String>) -> impl IntoView {
    reason.map(|reason| view! { <span>{reason}</span> })
}

const fn sensitive_reveal_stops_propagation() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sensitive_warning_attrs_keep_reason_and_reveal_label() {
        assert_eq!(
            sensitive_warning_attrs(Some("spoiler".to_owned())),
            SensitiveWarningAttrs {
                class_name: "content-warning",
                state: "hidden",
                title: "Sensitive content",
                reason: Some("spoiler".to_owned()),
                button_label: "Reveal",
            }
        );
    }

    #[test]
    fn sensitive_warning_attrs_do_not_invent_reason() {
        assert_eq!(sensitive_warning_attrs(None).reason, None);
    }

    #[test]
    fn sensitive_reveal_clicks_do_not_open_parent_row() {
        assert!(sensitive_reveal_stops_propagation());
    }
}
