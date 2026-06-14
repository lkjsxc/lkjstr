use leptos::prelude::Callback;

use crate::workspace::profile_clipboard_provider::ProfileCopyProvider;

#[derive(Clone, Default)]
pub(crate) struct AuthorContextActions {
    pub(crate) open_profile: Option<Callback<String>>,
    pub(crate) open_thread: Option<Callback<String>>,
    pub(crate) open_author_context: Option<Callback<(String, String)>>,
    pub(crate) copy_event_id: Option<ProfileCopyProvider>,
}
