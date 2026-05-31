#![doc = "Pure domain reducers and models for lkjstr."]

pub mod accounts;
pub mod local_account;
pub mod npub_miner;

pub use accounts::{
    Account, AccountCapabilities, SignerType, capabilities_for, create_account,
    create_labeled_account, normalize_account, parse_pubkey, parse_readonly_account, short_key,
    signer_type_key,
};
pub use local_account::{
    LocalAccountError, LocalAccountSecret, create_local_account_record, generate_nsec, parse_nsec,
    sign_local_event,
};
pub use npub_miner::{
    NpubPrefix, NpubPrefixError, estimated_attempts, npub_matches_prefix, parse_npub_prefix,
};

/// Crate ownership marker used by repository checks and docs.
pub const CRATE_OWNER: &str = "domain";
