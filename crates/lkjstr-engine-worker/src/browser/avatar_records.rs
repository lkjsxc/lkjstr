//! Metadata is separate from Blobs, so eviction scans never materialize the cache's pixel bytes.
use super::{Picture, valid};
use lkjstr_core::engine::avatars::cache::{Entry, Totals};
use serde::{Deserialize, Serialize};
use wasm_bindgen::{JsCast, JsValue};
use web_sys::{Blob, IdbObjectStore, IdbTransaction};
#[derive(Clone, Deserialize, Serialize)]
pub(super) struct Record {
    pub entry: Entry,
    // Missing on historical entries; touching one never establishes provenance.
    #[serde(default)]
    pub public_provenance: bool,
    edge: u32,
    source_width: u32,
    source_height: u32,
    mime: String,
}
impl Record {
    pub fn new(entry: Entry, picture: &Picture, public_provenance: bool) -> Self {
        Self {
            entry,
            public_provenance,
            edge: picture.edge,
            source_width: picture.source_width,
            source_height: picture.source_height,
            mime: picture.blob.type_(),
        }
    }
    pub fn picture(&self, value: JsValue) -> Option<Picture> {
        let picture = Picture {
            blob: value.dyn_into::<Blob>().ok()?,
            edge: self.edge,
            source_width: self.source_width,
            source_height: self.source_height,
        };
        (valid(&picture)
            && picture.blob.size() == self.entry.bytes as f64
            && picture.blob.type_() == self.mime)
            .then_some(picture)
    }
}
pub(super) fn decode<T: serde::de::DeserializeOwned>(value: JsValue) -> Result<T, JsValue> {
    serde_wasm_bindgen::from_value(value).map_err(|_| "avatar-cache-record".into())
}
pub(super) fn write<T: Serialize>(
    store: &IdbObjectStore,
    key: &str,
    value: &T,
) -> Result<(), JsValue> {
    let value = value
        .serialize(&serde_wasm_bindgen::Serializer::json_compatible())
        .map_err(|_| JsValue::from_str("avatar-cache-record"))?;
    store.put_with_key(&value, &key.into())?;
    Ok(())
}
pub(super) fn reset(tx: &IdbTransaction) -> Result<(), JsValue> {
    for name in ["entries", "blobs", "meta"] {
        tx.object_store(name)?.clear()?;
    }
    Ok(())
}
pub(super) fn totals(value: JsValue) -> Result<Totals, JsValue> {
    if value.is_undefined() {
        Ok(Totals::default())
    } else {
        decode(value)
    }
}
