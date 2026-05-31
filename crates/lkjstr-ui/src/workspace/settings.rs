use leptos::prelude::*;
use lkjstr_storage::SettingRecord;

use crate::workspace::settings_provider::SettingsProvider;
use crate::workspace::settings_row::{run_result, setting_row};

#[component]
pub fn SettingsTab(provider: Option<SettingsProvider>) -> impl IntoView {
    let provider = provider.unwrap_or_else(SettingsProvider::schema_only);
    let records = RwSignal::new(Vec::<SettingRecord>::new());
    let status = RwSignal::new(String::from("Loading settings"));
    let import_open = RwSignal::new(false);
    let import_draft = RwSignal::new(String::new());

    run_result(records, status, {
        let provider = provider.clone();
        move |complete| provider.load(complete)
    });

    let toggle_import = move |_| import_open.update(|open| *open = !*open);
    let import_input = move |event| import_draft.set(event_target_value(&event));
    let import_click = {
        let provider = provider.clone();
        move |_| {
            let raw = import_draft.get_untracked();
            run_result(records, status, {
                let provider = provider.clone();
                move |complete| provider.import_json(raw, complete)
            });
            import_draft.set(String::new());
            import_open.set(false);
        }
    };

    view! {
        <section class="settings-tab lkjstr-settings" aria-label="Settings" data-scroll-owner="">
            <header class="settings-header">
                <span>{move || changed_count(records.get())}" changed"</span>
                <div class="settings-actions">
                    <button type="button" on:click=toggle_import>"Import JSON"</button>
                </div>
            </header>
            <form class="settings-import" hidden=move || !import_open.get()>
                <textarea
                    aria-label="Settings JSON import"
                    rows="5"
                    prop:value=move || import_draft.get()
                    on:input=import_input
                ></textarea>
                <button type="button" on:click=import_click>"Import"</button>
            </form>
            <p role="status">{move || status.get()}</p>
            <div class="settings-layout">
                {move || records.get().into_iter().map(|row| {
                    setting_row(row, provider.clone(), records, status)
                }).collect_view()}
            </div>
        </section>
    }
}

fn changed_count(records: Vec<SettingRecord>) -> usize {
    records.into_iter().filter(|row| row.changed).count()
}
