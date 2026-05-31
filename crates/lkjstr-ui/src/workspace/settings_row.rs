use leptos::prelude::*;
use lkjstr_storage::{SettingRecord, SettingValueType};
use serde_json::{Number, Value};

use crate::workspace::settings_provider::{SettingsProvider, SettingsResult};

pub fn setting_row(
    row: SettingRecord,
    provider: SettingsProvider,
    records: RwSignal<Vec<SettingRecord>>,
    status: RwSignal<String>,
) -> impl IntoView {
    let reset_key = row.key.clone();
    let reset_provider = provider.clone();
    let reset = move |_| {
        let provider = reset_provider.clone();
        let key = reset_key.clone();
        run_result(records, status, move |complete| {
            provider.reset(key, complete);
        });
    };
    view! {
        <article class="settings-row">
            <div>
                <strong>{row.label.clone()}</strong>
                <code>{row.key.clone()}</code>
                <p>{row.description.clone()}</p>
            </div>
            <div class="settings-editor">
                {editor(row.clone(), provider, records, status)}
                <span>{if row.changed { "changed" } else { "default" }}</span>
                <button type="button" on:click=reset>"Reset"</button>
            </div>
        </article>
    }
}

fn editor(
    row: SettingRecord,
    provider: SettingsProvider,
    records: RwSignal<Vec<SettingRecord>>,
    status: RwSignal<String>,
) -> impl IntoView {
    match row.value_type {
        SettingValueType::Boolean => bool_editor(row, provider, records, status).into_any(),
        SettingValueType::Enum => enum_editor(row, provider, records, status).into_any(),
        SettingValueType::Json => json_editor(row, provider, records, status).into_any(),
        SettingValueType::Number | SettingValueType::String => {
            text_editor(row, provider, records, status).into_any()
        }
    }
}

fn bool_editor(
    row: SettingRecord,
    provider: SettingsProvider,
    records: RwSignal<Vec<SettingRecord>>,
    status: RwSignal<String>,
) -> impl IntoView {
    let key = row.key;
    let checked = row.value.as_bool().unwrap_or(false);
    let save = move |event| {
        save_value(
            &provider,
            &records,
            &status,
            key.clone(),
            Value::Bool(event_target_checked(&event)),
        );
    };
    view! { <input type="checkbox" prop:checked=checked on:change=save /> }
}

fn enum_editor(
    row: SettingRecord,
    provider: SettingsProvider,
    records: RwSignal<Vec<SettingRecord>>,
    status: RwSignal<String>,
) -> impl IntoView {
    let key = row.key;
    let current = value_text(&row.value);
    let save = move |event| {
        save_value(
            &provider,
            &records,
            &status,
            key.clone(),
            Value::String(event_target_value(&event)),
        );
    };
    view! {
        <select on:change=save>
            {row.options.into_iter().map(|option| {
                let selected = option == current;
                view! { <option value=option.clone() selected=selected>{option.clone()}</option> }
            }).collect_view()}
        </select>
    }
}

fn text_editor(
    row: SettingRecord,
    provider: SettingsProvider,
    records: RwSignal<Vec<SettingRecord>>,
    status: RwSignal<String>,
) -> impl IntoView {
    let key = row.key;
    let value_type = row.value_type;
    let input_type = if value_type == SettingValueType::Number {
        "number"
    } else {
        "text"
    };
    let value = value_text(&row.value);
    let save = move |event| match value_from_text(value_type, &event_target_value(&event)) {
        Some(value) => save_value(&provider, &records, &status, key.clone(), value),
        None => status.set(format!("Invalid value for {key}")),
    };
    view! { <input type=input_type prop:value=value on:change=save /> }
}

fn json_editor(
    row: SettingRecord,
    provider: SettingsProvider,
    records: RwSignal<Vec<SettingRecord>>,
    status: RwSignal<String>,
) -> impl IntoView {
    let key = row.key;
    let value = value_text(&row.value);
    let save = move |event| match serde_json::from_str::<Value>(&event_target_value(&event)) {
        Ok(value) => save_value(&provider, &records, &status, key.clone(), value),
        Err(_) => status.set(format!("Invalid JSON for {key}")),
    };
    view! { <textarea rows="3" prop:value=value on:change=save></textarea> }
}

fn save_value(
    provider: &SettingsProvider,
    records: &RwSignal<Vec<SettingRecord>>,
    status: &RwSignal<String>,
    key: String,
    value: Value,
) {
    let provider = provider.clone();
    run_result(*records, *status, move |complete| {
        provider.save(key, value, complete);
    });
}

pub fn run_result(
    records: RwSignal<Vec<SettingRecord>>,
    status: RwSignal<String>,
    run: impl FnOnce(Callback<SettingsResult>) + 'static,
) {
    let complete = Callback::new(move |result: SettingsResult| {
        records.set(result.records);
        status.set(result.status);
    });
    run(complete);
}

fn value_from_text(value_type: SettingValueType, text: &str) -> Option<Value> {
    if value_type == SettingValueType::Number {
        let number = text.parse::<f64>().ok()?;
        return Number::from_f64(number).map(Value::Number);
    }
    Some(Value::String(text.to_owned()))
}

fn value_text(value: &Value) -> String {
    value
        .as_str()
        .map_or_else(|| value.to_string(), ToOwned::to_owned)
}
