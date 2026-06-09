#![doc = "SQLite repository statement catalog accessors."]

use super::{
    SqliteStatementSpec, cache_statements, diagnostic_statements, optimizer_statements,
    repair_statements, search_statements, statements,
};

#[must_use]
pub const fn protected_sqlite_statements() -> &'static [SqliteStatementSpec] {
    statements::PROTECTED_STATEMENTS
}

#[must_use]
pub const fn cache_sqlite_statements() -> &'static [SqliteStatementSpec] {
    cache_statements::CACHE_STATEMENTS
}

#[must_use]
pub const fn search_sqlite_statements() -> &'static [SqliteStatementSpec] {
    search_statements::SEARCH_STATEMENTS
}

#[must_use]
pub const fn diagnostic_sqlite_statements() -> &'static [SqliteStatementSpec] {
    diagnostic_statements::DIAGNOSTIC_STATEMENTS
}

#[must_use]
pub const fn optimizer_sqlite_statements() -> &'static [SqliteStatementSpec] {
    optimizer_statements::OPTIMIZER_STATEMENTS
}

#[must_use]
pub const fn repair_sqlite_statements() -> &'static [SqliteStatementSpec] {
    repair_statements::REPAIR_STATEMENTS
}

#[must_use]
pub fn sqlite_repository_statements() -> Vec<&'static SqliteStatementSpec> {
    statements::PROTECTED_STATEMENTS
        .iter()
        .chain(cache_statements::CACHE_STATEMENTS.iter())
        .chain(search_statements::SEARCH_STATEMENTS.iter())
        .chain(optimizer_statements::OPTIMIZER_STATEMENTS.iter())
        .chain(diagnostic_statements::DIAGNOSTIC_STATEMENTS.iter())
        .chain(repair_statements::REPAIR_STATEMENTS.iter())
        .collect()
}

#[must_use]
pub fn sqlite_statement(id: &str) -> Option<&'static SqliteStatementSpec> {
    sqlite_repository_statements()
        .into_iter()
        .find(|statement| statement.id == id)
}
