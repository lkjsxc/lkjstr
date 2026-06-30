use leptos::prelude::*;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) enum ProfileAboutToken {
    Text(String),
    Link { text: String, href: String },
}

pub(crate) fn profile_about(text: String) -> impl IntoView {
    view! {
        <p class="profile-card__about">
            {profile_about_tokens(&text)
                .into_iter()
                .map(profile_about_token)
                .collect_view()}
        </p>
    }
}

fn profile_about_token(token: ProfileAboutToken) -> impl IntoView {
    match token {
        ProfileAboutToken::Text(text) => view! { <>{text}</> }.into_any(),
        ProfileAboutToken::Link { text, href } => view! {
            <a href=href target="_blank" rel="noopener noreferrer">{text}</a>
        }
        .into_any(),
    }
}

#[must_use]
pub(crate) fn profile_about_tokens(text: &str) -> Vec<ProfileAboutToken> {
    text.split_inclusive(char::is_whitespace)
        .flat_map(tokenize_piece)
        .collect()
}

fn tokenize_piece(piece: &str) -> Vec<ProfileAboutToken> {
    let trimmed = piece.trim_end_matches(char::is_whitespace);
    let whitespace = &piece[trimmed.len()..];
    let core = trimmed.trim_end_matches(trailing_punctuation);
    let punctuation = &trimmed[core.len()..];
    let mut out = match profile_about_href(core) {
        Some(href) => vec![ProfileAboutToken::Link {
            text: core.to_owned(),
            href,
        }],
        None => vec![ProfileAboutToken::Text(core.to_owned())],
    };
    if !punctuation.is_empty() {
        out.push(ProfileAboutToken::Text(punctuation.to_owned()));
    }
    if !whitespace.is_empty() {
        out.push(ProfileAboutToken::Text(whitespace.to_owned()));
    }
    out
}

fn trailing_punctuation(value: char) -> bool {
    matches!(value, '.' | ',' | ';' | ':' | '!' | '?' | ')')
}

fn profile_about_href(value: &str) -> Option<String> {
    if value.is_empty() || value.chars().any(char::is_control) {
        return None;
    }
    if value.starts_with("http://") || value.starts_with("https://") {
        return Some(value.to_owned());
    }
    if value.contains(':') || !value.contains('.') {
        return None;
    }
    Some(format!("https://{value}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_about_links_safe_urls_and_keeps_punctuation() {
        assert_eq!(
            profile_about_tokens("see example.com, and https://lkjstr.example."),
            vec![
                ProfileAboutToken::Text("see".to_owned()),
                ProfileAboutToken::Text(" ".to_owned()),
                ProfileAboutToken::Link {
                    text: "example.com".to_owned(),
                    href: "https://example.com".to_owned(),
                },
                ProfileAboutToken::Text(",".to_owned()),
                ProfileAboutToken::Text(" ".to_owned()),
                ProfileAboutToken::Text("and".to_owned()),
                ProfileAboutToken::Text(" ".to_owned()),
                ProfileAboutToken::Link {
                    text: "https://lkjstr.example".to_owned(),
                    href: "https://lkjstr.example".to_owned(),
                },
                ProfileAboutToken::Text(".".to_owned()),
            ],
        );
    }

    #[test]
    fn profile_about_rejects_unsafe_schemes() {
        assert_eq!(
            profile_about_tokens("javascript:alert(1)"),
            vec![
                ProfileAboutToken::Text("javascript:alert(1".to_owned()),
                ProfileAboutToken::Text(")".to_owned())
            ],
        );
    }
}
