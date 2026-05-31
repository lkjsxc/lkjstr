#![doc = "Pure relay-set records and reducers."]

mod defaults;
mod reducer;
mod types;

pub use defaults::{default_discovery_relay_set, default_user_relay_set};
pub use reducer::{
    add_relay, ensure_user_set, patch_relay, remove_relay, reset_relay_live_state,
    restore_default_relay_set, seed_relay_sets, sorted_relay_sets,
};
pub use types::{
    RelayConnectionState, RelayHealth, RelayPatch, RelayPurpose, RelayRecord, RelaySet,
    RelaySetError,
};
