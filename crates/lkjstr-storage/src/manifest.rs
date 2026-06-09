#![doc = "Executable storage table manifest."]

use crate::data_class::{StorageDataClass, StorageInventoryGroup};
use crate::resource::CacheResourceKind;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct StorageTableSpec {
    pub name: &'static str,
    pub schema: &'static str,
    pub data_class: StorageDataClass,
    pub inventory_group: StorageInventoryGroup,
    pub primary_owner: &'static str,
    pub command_family: &'static str,
    pub retention_behavior: &'static str,
    pub stats_projection: &'static str,
    pub ledger_resource_kind: Option<CacheResourceKind>,
    pub protected_by_default: bool,
    pub repairable: bool,
    pub compactable: bool,
}

#[must_use]
pub const fn storage_table_specs() -> &'static [StorageTableSpec] {
    crate::table_specs::STORAGE_TABLE_SPECS
}

#[must_use]
pub fn storage_table_names() -> Vec<&'static str> {
    crate::table_specs::STORAGE_TABLE_SPECS
        .iter()
        .map(|spec| spec.name)
        .collect()
}

#[must_use]
pub fn is_storage_table_name(name: &str) -> bool {
    crate::table_specs::STORAGE_TABLE_SPECS
        .iter()
        .any(|spec| spec.name == name)
}

#[must_use]
pub fn storage_table_spec(name: &str) -> Option<&'static StorageTableSpec> {
    crate::table_specs::STORAGE_TABLE_SPECS
        .iter()
        .find(|spec| spec.name == name)
}

#[must_use]
pub fn storage_manifest_group(name: &str) -> Option<StorageInventoryGroup> {
    storage_table_spec(name).map(|spec| spec.inventory_group)
}
