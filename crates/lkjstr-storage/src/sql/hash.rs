#![doc = "SQLite schema hash helper."]

use super::sqlite_schema_statements;

#[must_use]
pub fn sqlite_schema_hash() -> String {
    let mut hash = 0xcbf29ce484222325_u64;
    for statement in sqlite_schema_statements() {
        for byte in statement.sql.bytes().chain(std::iter::once(0)) {
            hash ^= u64::from(byte);
            hash = hash.wrapping_mul(0x100000001b3);
        }
    }
    format!("{hash:016x}")
}
