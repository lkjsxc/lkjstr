#![doc = "Executable SQLite schema records."]

mod cache;
mod diagnostics;
mod indexes;
mod metadata;
mod protected;

use crate::{
    data_class::{StorageDataClass, StorageInventoryGroup},
    resource::CacheResourceKind,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SqliteRetentionClass {
    Protected,
    DynamicProtected,
    Recoverable,
    Ledger,
    Metadata,
}

impl SqliteRetentionClass {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Protected => "protected",
            Self::DynamicProtected => "dynamic-protected",
            Self::Recoverable => "recoverable",
            Self::Ledger => "ledger",
            Self::Metadata => "metadata",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SqliteTableSpec {
    pub name: &'static str,
    pub create_sql: &'static str,
    pub data_class: StorageDataClass,
    pub inventory_group: StorageInventoryGroup,
    pub primary_owner: &'static str,
    pub retention: SqliteRetentionClass,
    pub ledger_resource_kind: Option<CacheResourceKind>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SqliteIndexSpec {
    pub name: &'static str,
    pub table_name: &'static str,
    pub create_sql: &'static str,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SqliteStatementKind {
    Pragma,
    Table,
    Index,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SqliteSchemaStatement {
    pub id: &'static str,
    pub sql: &'static str,
    pub kind: SqliteStatementKind,
}

pub const FOREIGN_KEYS_PRAGMA: SqliteSchemaStatement = SqliteSchemaStatement {
    id: "pragma_foreign_keys",
    sql: "PRAGMA foreign_keys = ON;",
    kind: SqliteStatementKind::Pragma,
};

#[must_use]
pub fn sqlite_schema_tables() -> Vec<&'static SqliteTableSpec> {
    protected::SQLITE_PROTECTED_TABLES
        .iter()
        .chain(cache::SQLITE_CACHE_TABLES.iter())
        .chain(diagnostics::SQLITE_DIAGNOSTIC_TABLES.iter())
        .chain(metadata::SQLITE_METADATA_TABLES.iter())
        .collect()
}

#[must_use]
pub fn sqlite_schema_table_names() -> Vec<&'static str> {
    sqlite_schema_tables()
        .into_iter()
        .map(|spec| spec.name)
        .collect()
}

#[must_use]
pub fn sqlite_schema_table(name: &str) -> Option<&'static SqliteTableSpec> {
    sqlite_schema_tables()
        .into_iter()
        .find(|spec| spec.name == name)
}

#[must_use]
pub const fn sqlite_schema_indexes() -> &'static [SqliteIndexSpec] {
    indexes::SQLITE_INDEXES
}

#[must_use]
pub fn sqlite_schema_index_names() -> Vec<&'static str> {
    indexes::SQLITE_INDEXES
        .iter()
        .map(|spec| spec.name)
        .collect()
}

#[must_use]
pub fn sqlite_schema_statements() -> Vec<SqliteSchemaStatement> {
    std::iter::once(FOREIGN_KEYS_PRAGMA)
        .chain(
            sqlite_schema_tables()
                .into_iter()
                .map(|table| SqliteSchemaStatement {
                    id: table.name,
                    sql: table.create_sql,
                    kind: SqliteStatementKind::Table,
                }),
        )
        .chain(
            indexes::SQLITE_INDEXES
                .iter()
                .map(|index| SqliteSchemaStatement {
                    id: index.name,
                    sql: index.create_sql,
                    kind: SqliteStatementKind::Index,
                }),
        )
        .collect()
}
