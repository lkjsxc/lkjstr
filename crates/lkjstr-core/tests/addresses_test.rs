use lkjstr_core::{
    View,
    addresses::{parse, path},
};

#[test]
fn public_paths_round_trip_without_state_or_dotted_paths() {
    for view in [
        View::Home,
        View::Global,
        View::Notifications,
        View::Accounts,
        View::Settings,
        View::Relays,
        View::Compose { reply_to: None },
        View::Profile {
            pubkey: "a".repeat(64),
        },
        View::Thread {
            id: "b".repeat(64),
            relays: vec![],
        },
        View::Search {
            query: "日本語 & English #notes".into(),
        },
    ] {
        let route = path(&view);
        assert!(!route.contains("%7B") && !route.contains("#view"));
        let (route, query) = route.split_once('?').unwrap_or((&route, ""));
        assert!(!route.contains('.'));
        assert_eq!(parse(route, query), Some(view));
    }
}

#[test]
fn invalid_and_secret_addresses_never_become_public_state() {
    assert_eq!(parse("/", ""), None);
    for (path, query) in [
        ("/what", ""),
        ("/r/relay.example", ""),
        ("/home", "theme=dark"),
        ("/search", "q=a&theme=dark"),
        ("/p/nsec1private", ""),
        ("/search", "q=nsec1private"),
    ] {
        assert_eq!(parse(path, query), Some(View::NotFound));
    }
    assert_eq!(
        path(&View::Search {
            query: "nostr:nsec1private".into()
        }),
        "/"
    );
    assert_eq!(
        path(&View::Image {
            url: "https://example.org/a.png".into()
        }),
        "/"
    );
}

#[test]
fn default_desk_has_no_welcome_tab() {
    let ws = lkjstr_core::Workspace::preset(false);
    assert_eq!(
        ws.tabs.get(&ws.focused_tab().unwrap_or(0)),
        Some(&View::Global)
    );
    assert!(!ws.tabs.values().any(|v| v.title() == "Welcome"));
}

#[test]
fn pasted_secrets_do_not_enter_saved_public_views_or_their_history() {
    let marker = "nsec1private-test-marker";
    let mut ws = lkjstr_core::Workspace::preset(false);
    let tab = ws.open(
        View::Search {
            query: marker.into(),
        },
        lkjstr_core::Open::Here,
    );
    assert_eq!(ws.tabs.get(&tab), Some(&View::Accounts));
    ws.navigate(
        tab,
        View::Search {
            query: marker.into(),
        },
    );
    assert!(
        !serde_json::to_string(&ws)
            .unwrap_or_default()
            .contains(marker)
    );
}
