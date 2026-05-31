use lkjstr_storage::{StorageTableSpec, storage_table_specs};
use wasm_bindgen::prelude::JsValue;
use web_sys::{IdbDatabase, IdbObjectStore, IdbObjectStoreParameters};

pub fn ensure_schema(db: &IdbDatabase) -> Result<(), JsValue> {
    let stores = db.object_store_names();
    for spec in storage_table_specs() {
        if !stores.contains(spec.name) {
            create_store(db, spec)?;
        }
    }
    Ok(())
}

fn create_store(db: &IdbDatabase, spec: &StorageTableSpec) -> Result<(), JsValue> {
    let primary_key = primary_key_path(spec.schema)?;
    let options = IdbObjectStoreParameters::new();
    options.set_key_path(&JsValue::from_str(primary_key));
    let store = db.create_object_store_with_optional_parameters(spec.name, &options)?;
    create_indexes(&store, spec.schema)
}

fn create_indexes(store: &IdbObjectStore, schema: &str) -> Result<(), JsValue> {
    for token in schema_tokens(schema).into_iter().skip(1) {
        create_index(store, token)?;
    }
    Ok(())
}

fn create_index(store: &IdbObjectStore, token: &str) -> Result<(), JsValue> {
    let clean = clean_token(token);
    if clean.is_empty() {
        return Ok(());
    }
    if let Some(fields) = compound_fields(clean) {
        return store
            .create_index_with_str_sequence(token, &fields.into())
            .map(|_| ());
    }
    store.create_index_with_str(clean, clean).map(|_| ())
}

fn primary_key_path(schema: &str) -> Result<&str, JsValue> {
    let Some(first) = schema_tokens(schema).first().copied() else {
        return Err(JsValue::from_str("missing primary key"));
    };
    let key = clean_token(first);
    if key.is_empty() || key.starts_with('[') {
        return Err(JsValue::from_str("unsupported primary key"));
    }
    Ok(key)
}

fn schema_tokens(schema: &str) -> Vec<&str> {
    schema
        .split(',')
        .map(str::trim)
        .filter(|token| !token.is_empty())
        .collect()
}

fn clean_token(token: &str) -> &str {
    token
        .trim()
        .trim_start_matches('&')
        .trim_start_matches('*')
        .trim_start_matches("++")
}

fn compound_fields(token: &str) -> Option<js_sys::Array> {
    let inner = token.strip_prefix('[')?.strip_suffix(']')?;
    let fields = js_sys::Array::new();
    for field in inner.split('+').map(str::trim) {
        if field.is_empty() {
            return None;
        }
        fields.push(&JsValue::from_str(field));
    }
    Some(fields)
}
