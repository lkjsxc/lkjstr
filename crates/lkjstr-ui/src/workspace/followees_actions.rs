use leptos::prelude::Callback;

#[derive(Clone, Default)]
pub(crate) struct FolloweesActions {
    pub(crate) open_profile: Option<Callback<String>>,
    pub(crate) open_user_timeline: Option<Callback<String>>,
    pub(crate) copy_npub: Option<Callback<String>>,
}
