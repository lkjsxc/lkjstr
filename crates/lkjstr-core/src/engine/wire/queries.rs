use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Query {
    pub source: String,
    pub private_lists: Option<bool>,
    pub account: Option<String>,
    pub pubkey: Option<String>,
    pub id: Option<String>,
    #[serde(rename = "ref")]
    pub reference: Option<String>,
    pub tag: Option<String>,
    pub relay: Option<String>,
    pub authors: Option<Vec<String>>,
    pub since: Option<u64>,
    pub until: Option<u64>,
    pub types: Option<Vec<String>>,
    pub media: Option<String>,
    pub replies: Option<bool>,
    pub reposts: Option<bool>,
    pub language: Option<Vec<String>>,
    pub text: Option<String>,
    pub phrases: Option<Vec<String>>,
    pub exclude: Option<Vec<String>>,
    pub has: Option<Vec<String>>,
    pub from: Option<Vec<String>>,
    pub notifications: Option<bool>,
    pub show: Option<String>,
}
#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum Anchor {
    Top(String),
    Key {
        key: String,
    },
    Time {
        at: u64,
    },
    Month {
        month: u64,
        offset: usize,
        #[serde(rename = "returnKey")]
        return_key: Option<String>,
    },
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Hint {
    pub delivery_watches: Option<Vec<String>>,
    pub visible_subs: Vec<String>,
    pub focused_sub: Option<String>,
    pub page_hidden: bool,
    #[serde(default)]
    pub idle: bool,
    #[serde(default)]
    pub save_data: bool,
    pub effective_type: Option<String>,
    pub device_memory: Option<f64>,
    pub since_scroll_ms: Option<f64>,
    pub since_input_ms: Option<f64>,
    pub scroll_rows_per_s: Option<f64>,
}
#[derive(Debug, Clone, Deserialize, Default)]
pub struct Config {
    #[serde(default, rename = "linkPreviews")]
    pub link_previews: Option<bool>,
    #[serde(default)]
    pub language: String,
    #[serde(default, rename = "clientTag")]
    pub client_tag: Option<bool>,
    #[serde(default, rename = "clientTagAccount")]
    pub client_tag_account: Option<String>,
    #[serde(default, rename = "signedOutGlobalFilter")]
    pub signed_out_global_filter: Option<bool>,
    #[serde(default)]
    pub heuristics: bool,
    #[serde(default)]
    pub prefetch: bool,
}
