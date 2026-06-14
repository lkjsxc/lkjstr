use leptos::prelude::Callback;

#[derive(Clone, Default)]
pub(crate) struct UserTimelineActions {
    pub(crate) open_profile: Option<Callback<String>>,
    pub(crate) open_thread: Option<Callback<String>>,
    pub(crate) open_author_context: Option<Callback<(String, String)>>,
}
