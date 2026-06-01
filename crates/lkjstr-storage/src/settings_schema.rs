#![doc = "Flat settings schema and override merging."]

use serde::{Deserialize, Serialize};
use serde_json::{Number, Value};

use crate::settings::{SettingOverrideRecord, setting_namespace};
use crate::settings_defs::{SETTINGS, SettingDefinition};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum SettingValueType {
    String,
    Number,
    Boolean,
    Enum,
    Json,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingRecord {
    pub key: String,
    pub namespace: String,
    pub label: String,
    pub description: String,
    pub value_type: SettingValueType,
    pub default_value: Value,
    pub value: Value,
    pub options: Vec<String>,
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub step: Option<f64>,
    pub integer: bool,
    pub sensitive: bool,
    pub changed: bool,
    pub updated_at: u64,
}

#[must_use]
pub fn default_setting_records(now: u64) -> Vec<SettingRecord> {
    SETTINGS
        .iter()
        .map(|item| record(item, None, now))
        .collect()
}

#[must_use]
pub fn merge_setting_overrides(
    overrides: &[SettingOverrideRecord],
    now: u64,
) -> Vec<SettingRecord> {
    SETTINGS
        .iter()
        .map(|item| {
            let override_row = overrides.iter().find(|row| row.key == item.key);
            record(item, override_row, now)
        })
        .collect()
}

#[must_use]
pub fn setting_override_for_value(
    key: &str,
    value: Value,
    now: u64,
) -> Option<SettingOverrideRecord> {
    let definition = SETTINGS.iter().find(|item| item.key == key)?;
    let value = coerce_value(definition, value)?;
    Some(SettingOverrideRecord {
        key: key.to_owned(),
        namespace: namespace(key),
        value,
        updated_at: now,
    })
}

fn record(
    item: &SettingDefinition,
    override_row: Option<&SettingOverrideRecord>,
    now: u64,
) -> SettingRecord {
    let default_value = default_value(item);
    let override_value = override_row.and_then(|row| coerce_value(item, row.value.clone()));
    let value = override_value.unwrap_or_else(|| default_value.clone());
    SettingRecord {
        key: item.key.to_owned(),
        namespace: namespace(item.key),
        label: item.label.to_owned(),
        description: item.description.to_owned(),
        value_type: item.value_type,
        default_value: default_value.clone(),
        value: value.clone(),
        options: item
            .options
            .iter()
            .map(|option| (*option).to_owned())
            .collect(),
        min: item.number.min,
        max: item.number.max,
        step: item.number.step,
        integer: item.number.integer,
        sensitive: item.key.starts_with("security."),
        changed: value != default_value,
        updated_at: override_row.map_or(now, |row| row.updated_at),
    }
}

fn default_value(item: &SettingDefinition) -> Value {
    match item.value_type {
        SettingValueType::Boolean => Value::Bool(item.default_raw == "true"),
        SettingValueType::Number => item
            .default_raw
            .parse::<i64>()
            .map_or(Value::Null, |number| Value::Number(number.into())),
        SettingValueType::Json => serde_json::from_str(item.default_raw).unwrap_or(Value::Null),
        SettingValueType::String | SettingValueType::Enum => {
            Value::String(item.default_raw.to_owned())
        }
    }
}

fn coerce_value(item: &SettingDefinition, value: Value) -> Option<Value> {
    match item.value_type {
        SettingValueType::Boolean => value.as_bool().map(Value::Bool),
        SettingValueType::Number => coerce_number(item, value.as_f64()?),
        SettingValueType::Enum => coerce_enum(item, value),
        SettingValueType::Json => Some(value),
        SettingValueType::String => coerce_string(item, value),
    }
}

fn coerce_number(item: &SettingDefinition, number: f64) -> Option<Value> {
    if !number.is_finite() || item.number.min.is_some_and(|min| number < min) {
        return None;
    }
    if item.number.max.is_some_and(|max| number > max) {
        return None;
    }
    if item.number.integer && number.fract() != 0.0 {
        return None;
    }
    Number::from_f64(number).map(Value::Number)
}

fn coerce_enum(item: &SettingDefinition, value: Value) -> Option<Value> {
    let value = value.as_str()?;
    item.options
        .contains(&value)
        .then(|| Value::String(value.to_owned()))
}

fn coerce_string(item: &SettingDefinition, value: Value) -> Option<Value> {
    let value = value.as_str()?.trim();
    if item.key == "tweet.mediaUploadCustomServer"
        && !(value.is_empty() || value.starts_with("https://"))
    {
        return None;
    }
    Some(Value::String(value.to_owned()))
}

fn namespace(key: &str) -> String {
    setting_namespace(key)
}
