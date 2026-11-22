//! Avatar-only effects; raw bodies and derived Blobs stay outside native policy.
#[path = "avatar_db.rs"]
mod db;
#[path = "avatar_fetch.rs"]
mod fetch;
#[path = "avatar_pixels.rs"]
mod pixels;
#[path = "avatar_store.rs"]
mod store;
pub use db::Database;
pub use fetch::get;
pub use pixels::{Picture, derive, valid};
pub use store::{lookup, put};
