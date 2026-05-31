use leptos::prelude::*;
use lkjstr_domain::{
    UploadSettings, default_upload_settings, upload_provider_configs, upload_settings,
    valid_custom_upload_server,
};

use crate::workspace::upload_settings_provider::{UploadSettingsProvider, UploadSettingsResult};

#[component]
pub fn UploadSettingsTab(provider: Option<UploadSettingsProvider>) -> impl IntoView {
    let provider = provider.unwrap_or_else(UploadSettingsProvider::unavailable);
    let settings = RwSignal::new(default_upload_settings());
    let status = RwSignal::new(String::from("Loading upload settings"));
    let custom_draft = RwSignal::new(String::new());

    run_result(settings, status, custom_draft, {
        let provider = provider.clone();
        move |complete| provider.load(complete)
    });

    view! {
        <section class="data-tab upload-settings-tab" aria-label="Upload Settings">
            <fieldset>
                <legend>"Provider"</legend>
                {upload_provider_configs().iter().map(|config| {
                    provider_choice(*config, provider.clone(), settings, status, custom_draft)
                }).collect_view()}
            </fieldset>
            {custom_server_editor(provider.clone(), settings, status, custom_draft)}
            {no_transform_editor(provider.clone(), settings, status, custom_draft)}
            <dl class="upload-settings-summary">
                <dt>"Resolved server"</dt>
                <dd data-testid="upload-settings-resolved-server">
                    {move || resolved_server(settings.get(), custom_draft.get())}
                </dd>
            </dl>
            {discovery_button(provider, settings, status, custom_draft)}
            <p role="status">{move || status.get()}</p>
        </section>
    }
}

fn provider_choice(
    config: lkjstr_domain::UploadProviderConfig,
    provider: UploadSettingsProvider,
    settings: RwSignal<UploadSettings>,
    status: RwSignal<String>,
    custom_draft: RwSignal<String>,
) -> impl IntoView {
    let id = config.id;
    let key = config.key;
    let selected = move || settings.get().provider == id;
    let choose = move |_| {
        run_result(settings, status, custom_draft, {
            let provider = provider.clone();
            move |complete| provider.save_provider(id, complete)
        });
    };
    view! {
        <label>
            <input
                type="radio"
                name="media-upload-provider"
                value=key
                prop:checked=selected
                on:change=choose
            />
            {config.label}
        </label>
    }
}

fn custom_server_editor(
    provider: UploadSettingsProvider,
    settings: RwSignal<UploadSettings>,
    status: RwSignal<String>,
    custom_draft: RwSignal<String>,
) -> impl IntoView {
    let input = move |event| custom_draft.set(event_target_value(&event));
    let save = move |_| {
        let draft = custom_draft.get_untracked();
        if !valid_custom_upload_server(&draft) {
            status.set("Custom upload server must be blank or HTTPS.".to_owned());
            return;
        }
        run_result(settings, status, custom_draft, {
            let provider = provider.clone();
            move |complete| provider.save_custom(draft, complete)
        });
    };
    view! {
        <label>
            "Custom server"
            <input
                aria-label="Custom upload server"
                aria-invalid=move || invalid_custom_attr(custom_draft.get())
                placeholder="https://media.example"
                prop:value=move || custom_draft.get()
                on:input=input
                on:change=save
            />
        </label>
        <Show when=move || !valid_custom_upload_server(&custom_draft.get())>
            <p role="alert">"Custom upload server must be blank or HTTPS."</p>
        </Show>
    }
}

fn no_transform_editor(
    provider: UploadSettingsProvider,
    settings: RwSignal<UploadSettings>,
    status: RwSignal<String>,
    custom_draft: RwSignal<String>,
) -> impl IntoView {
    let save = move |event| {
        let value = event_target_checked(&event);
        run_result(settings, status, custom_draft, {
            let provider = provider.clone();
            move |complete| provider.save_no_transform(value, complete)
        });
    };
    view! {
        <label>
            <input type="checkbox" prop:checked=move || settings.get().no_transform on:change=save />
            "No transform"
        </label>
    }
}

fn discovery_button(
    provider: UploadSettingsProvider,
    settings: RwSignal<UploadSettings>,
    status: RwSignal<String>,
    custom_draft: RwSignal<String>,
) -> impl IntoView {
    let discover = move |_| {
        let current = settings.get_untracked();
        let server = resolved_server(current.clone(), custom_draft.get_untracked());
        if server.trim().is_empty() {
            status.set("Media upload is disabled.".to_owned());
            return;
        }
        if !valid_custom_upload_server(&custom_draft.get_untracked()) {
            status.set("Custom upload server must be blank or HTTPS.".to_owned());
            return;
        }
        status.set("Testing discovery...".to_owned());
        run_result(settings, status, custom_draft, {
            let provider = provider.clone();
            move |complete| provider.discover(current, server, complete)
        });
    };
    view! {
        <button type="button" on:click=discover>"Test discovery"</button>
    }
}

fn run_result(
    settings: RwSignal<UploadSettings>,
    status: RwSignal<String>,
    custom_draft: RwSignal<String>,
    run: impl FnOnce(Callback<UploadSettingsResult>) + 'static,
) {
    let complete = Callback::new(move |result: UploadSettingsResult| {
        let _unused = custom_draft.try_set(result.settings.custom_server.clone());
        let _unused = settings.try_set(result.settings);
        let _unused = status.try_set(result.status);
    });
    run(complete);
}

fn resolved_server(settings: UploadSettings, custom: String) -> String {
    upload_settings(settings.provider, custom, settings.no_transform).server
}

fn invalid_custom_attr(value: String) -> &'static str {
    if valid_custom_upload_server(&value) {
        "false"
    } else {
        "true"
    }
}
