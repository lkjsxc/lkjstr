//! Public addresses contain only validated public identifiers and search words.
//! Unaddressed views keep their state in the workspace, never in the URL.
use crate::View;
use lkjstr_protocol::{NostrEntity, decode_nip19, encode_note, encode_npub};

pub fn path(view: &View) -> String {
    match view {
        View::Home => "/home".into(),
        View::Global => "/global".into(),
        View::Notifications => "/notifications".into(),
        View::Search { query } if safe_query(query) => {
            let query: String = url::form_urlencoded::Serializer::new(String::new())
                .append_pair("q", query)
                .finish();
            format!("/search?{query}")
        }
        View::Thread { id, .. } => encode_note(id)
            .map(|s| format!("/n/{s}"))
            .unwrap_or("/".into()),
        View::Profile { pubkey } => encode_npub(pubkey)
            .map(|s| format!("/p/{s}"))
            .unwrap_or("/".into()),
        View::Compose { .. } => "/compose".into(),
        View::Relays => "/relays".into(),
        View::Accounts => "/accounts".into(),
        View::Settings => "/settings".into(),
        View::NotFound => "/nothing".into(),
        _ => "/".into(),
    }
}

pub fn safe_query(query: &str) -> bool {
    query.len() <= 4096 && !query.to_ascii_lowercase().contains("nsec1")
}

/// Root means restore the saved desk; all other invalid paths get a plain tab.
pub fn parse(path: &str, query: &str) -> Option<View> {
    if path == "/" && query.is_empty() {
        return None;
    }
    Some(decode(path, query).unwrap_or(View::NotFound))
}

fn decode(path: &str, query: &str) -> Option<View> {
    if path.contains('.') || path.len() > 5000 || (!query.is_empty() && path != "/search") {
        return None;
    }
    Some(match path {
        "/home" => View::Home,
        "/global" => View::Global,
        "/notifications" => View::Notifications,
        "/compose" => View::Compose { reply_to: None },
        "/accounts" => View::Accounts,
        "/settings" => View::Settings,
        "/relays" => View::Relays,
        "/search" => {
            let pairs: Vec<_> =
                url::form_urlencoded::parse(query.trim_start_matches('?').as_bytes()).collect();
            if pairs.len() > 1
                || pairs
                    .first()
                    .is_some_and(|(key, value)| key != "q" || !safe_query(value))
            {
                return None;
            }
            View::Search {
                query: pairs
                    .first()
                    .map(|(_, v)| v.to_string())
                    .unwrap_or_default(),
            }
        }
        _ => match path
            .split_once('/')
            .and_then(|(_, rest)| rest.split_once('/'))
        {
            Some(("n", code)) => match decode_nip19(code)? {
                NostrEntity::Note(id) => View::Thread { id, relays: vec![] },
                _ => return None,
            },
            Some(("p", code)) => match decode_nip19(code)? {
                NostrEntity::Npub(pubkey) => View::Profile { pubkey },
                _ => return None,
            },
            _ => return None,
        },
    })
}

/// A pasted secret is never retained in a public view or saved layout.
pub fn public_view(view: View) -> View {
    if matches!(&view, View::Search { query } if !safe_query(query)) {
        View::Accounts
    } else {
        view
    }
}

impl crate::Workspace {
    /// Reload addresses identify a saved view without replacing its private state.
    pub fn restore_address(&mut self, view: View, resumed: bool) {
        if resumed
            && self
                .focused_tab()
                .and_then(|tab| self.tabs.get(&tab))
                .is_some_and(|saved| parse_path(saved).as_ref() == Some(&view))
        {
            return;
        }
        self.open(view, crate::Open::Here);
    }
}

fn parse_path(view: &View) -> Option<View> {
    let address = path(view);
    let (path, query) = address.split_once('?').unwrap_or((&address, ""));
    parse(path, query)
}
