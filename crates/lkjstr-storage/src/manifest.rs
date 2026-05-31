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
    pub ledger_resource_kind: Option<CacheResourceKind>,
    pub protected_by_default: bool,
    pub repairable: bool,
    pub compactable: bool,
}

pub(crate) const fn table(
    name: &'static str,
    schema: &'static str,
    data_class: StorageDataClass,
    inventory_group: StorageInventoryGroup,
    primary_owner: &'static str,
    protected_by_default: bool,
) -> StorageTableSpec {
    StorageTableSpec {
        name,
        schema,
        data_class,
        inventory_group,
        primary_owner,
        ledger_resource_kind: None,
        protected_by_default,
        repairable: false,
        compactable: false,
    }
}

pub(crate) const fn ledger_table(
    name: &'static str,
    schema: &'static str,
    data_class: StorageDataClass,
    inventory_group: StorageInventoryGroup,
    primary_owner: &'static str,
    ledger_resource_kind: CacheResourceKind,
    protected_by_default: bool,
) -> StorageTableSpec {
    StorageTableSpec {
        name,
        schema,
        data_class,
        inventory_group,
        primary_owner,
        ledger_resource_kind: Some(ledger_resource_kind),
        protected_by_default,
        repairable: true,
        compactable: true,
    }
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
