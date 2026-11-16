//! Only provider-authorized, globally deduplicated payments become people rows.
use super::{Sender, Target, Total, TrustedReceipt};
use serde::{Deserialize, Serialize};

pub const MAX_ROWS: usize = 200;
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiptCursor {
    pub at: u64,
    pub id: String,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Verification {
    ProviderAuthorized,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiptRow {
    pub id: String,
    #[serde(serialize_with = "super::millis")]
    pub created_at: u64,
    pub target: Target,
    pub sender: Sender,
    pub recipient: String,
    pub provider: String,
    pub amount_msat: String,
    pub verification: Verification,
    pub recipient_profile: String,
    pub provider_endpoint: String,
    #[serde(serialize_with = "super::millis")]
    pub provider_observed_at: u64,
    #[serde(serialize_with = "super::millis")]
    pub verified_at: u64,
}
impl From<&TrustedReceipt> for ReceiptRow {
    fn from(value: &TrustedReceipt) -> Self {
        Self {
            id: value.id.clone(),
            created_at: value.created_at,
            target: value.target.clone(),
            sender: value.payer.clone(),
            recipient: value.recipient.clone(),
            provider: value.provider.clone(),
            amount_msat: value.amount_msat.to_string(),
            verification: Verification::ProviderAuthorized,
            recipient_profile: value.proof.profile.clone(),
            provider_endpoint: value.proof.endpoint.clone(),
            provider_observed_at: value.provider_observed_at,
            verified_at: value.verified_at,
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiptPage {
    pub target: Target,
    pub rows: Vec<ReceiptRow>,
    pub total: Total,
    /// A cursor only paginates retained verified receipts, not the entire network.
    pub cursor: Option<ReceiptCursor>,
    pub more: bool,
}
