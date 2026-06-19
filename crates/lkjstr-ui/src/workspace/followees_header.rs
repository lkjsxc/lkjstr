use leptos::prelude::*;
use lkjstr_app::{FolloweesProfile, FolloweesView};

pub(crate) fn followees_header(model: FolloweesView) -> impl IntoView {
    let profile = model.target_profile;
    let label = followees_header_label(model.target_pubkey.as_deref(), profile.as_ref());
    let subtitle = profile.as_ref().and_then(|item| item.subtitle.clone());
    let avatar_url = profile.and_then(|item| item.avatar_url);
    let avatar_alt = label.clone();
    view! {
        <header class="profile-card" data-testid="rust-followees-header">
            <div class="profile-card__main">
                {avatar_url.map(|url| view! {
                    <div class="profile-card__top">
                        <div class="profile-card__avatar">
                            <img class="avatar lg" src=url alt=avatar_alt />
                        </div>
                    </div>
                })}
                <div class="profile-card__identity">
                    <h2>{label}</h2>
                    <p>{subtitle.unwrap_or_else(|| "Following".to_owned())}</p>
                    <small>{format!("{} entries", model.following_count)}</small>
                </div>
            </div>
        </header>
    }
}

fn followees_header_label(
    target_pubkey: Option<&str>,
    profile: Option<&FolloweesProfile>,
) -> String {
    profile
        .and_then(|item| item.display_name.clone())
        .filter(|item| !item.trim().is_empty())
        .unwrap_or_else(|| {
            if target_pubkey.is_some() {
                "Viewed profile".to_owned()
            } else {
                "Unknown profile".to_owned()
            }
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn followees_header_label_uses_profile_or_non_raw_fallback() {
        assert_eq!(followees_header_label(Some("a"), None), "Viewed profile");
        assert_eq!(followees_header_label(None, None), "Unknown profile");
        assert_eq!(
            followees_header_label(
                Some("a"),
                Some(&FolloweesProfile {
                    pubkey: "a".to_owned(),
                    display_name: Some("Target Profile".to_owned()),
                    subtitle: None,
                    avatar_url: None,
                })
            ),
            "Target Profile"
        );
    }
}
