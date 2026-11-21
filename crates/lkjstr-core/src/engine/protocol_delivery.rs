use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Delivery {
    pub relay: String,
    pub state: String,
    pub message: Option<String>,
}
