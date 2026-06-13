use leptos::{ev::MouseEvent, prelude::*};

pub(crate) fn edit_profile_button(
    own_profile: bool,
    open_profile_edit: Option<Callback<()>>,
) -> impl IntoView {
    let (true, Some(open_profile_edit)) = (own_profile, open_profile_edit) else {
        return ().into_any();
    };
    let open = move |_event: MouseEvent| {
        open_profile_edit.run(());
    };
    view! {
        <button type="button" aria-label="Edit profile" on:click=open>
            "Edit profile"
        </button>
    }
    .into_any()
}
