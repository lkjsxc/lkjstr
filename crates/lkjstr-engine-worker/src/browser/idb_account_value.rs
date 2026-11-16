//! A get result alone cannot distinguish a missing row from stored undefined.
use lkjstr_core::engine::{account_storage::Failure, accounts::secret::SecretText};
use web_sys::{IdbObjectStore, IdbRequest};
pub(super) struct Record {
    value: IdbRequest,
    pub key: IdbRequest,
}
impl Record {
    pub fn read(store: &IdbObjectStore, key: &str) -> Result<Self, Failure> {
        Ok(Self {
            value: store.get(&key.into()).map_err(|_| Failure::Unavailable)?,
            key: store
                .get_key(&key.into())
                .map_err(|_| Failure::Unavailable)?,
        })
    }
    /// Both requests must have completed in the same transaction.
    pub fn text(&self) -> Result<Option<SecretText>, Failure> {
        let present = self.key.result().map_err(|_| Failure::Unavailable)?;
        if present.is_undefined() {
            return Ok(None);
        }
        self.value
            .result()
            .map_err(|_| Failure::Unavailable)?
            .as_string()
            .map(SecretText::new)
            .map(Some)
            .ok_or(Failure::Unavailable)
    }
}
