#![doc = "Outbound REQ message byte budgeting."]

use lkjstr_protocol::{ClientMessage, NostrFilter, ProtocolError, encode_client_message};

pub const fn app_max_req_message_bytes() -> usize {
    64 * 1024
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RequestMessageSizeWarning {
    pub relay_url: String,
    pub estimated_bytes: usize,
    pub active_cap: usize,
    pub cap_source: RequestMessageSizeCapSource,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RequestMessageSizeCapSource {
    App,
    Nip11,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RequestMessageSizeDecision {
    Send { estimated_bytes: usize, cap: usize },
    Reject(RequestMessageSizeWarning),
}

pub fn estimate_req_message_bytes(
    sub_id: &str,
    filters: &[NostrFilter],
) -> Result<usize, ProtocolError> {
    encode_client_message(&ClientMessage::Req {
        subscription_id: sub_id.to_owned(),
        filters: filters.to_vec(),
    })
    .map(|message| message.len())
}

pub fn request_message_size_decision(
    relay_url: impl Into<String>,
    sub_id: &str,
    filters: &[NostrFilter],
    relay_max_message_length: Option<usize>,
) -> Result<RequestMessageSizeDecision, ProtocolError> {
    let bytes = estimate_req_message_bytes(sub_id, filters)?;
    let (cap, cap_source) = active_cap(relay_max_message_length);
    if bytes <= cap {
        return Ok(RequestMessageSizeDecision::Send {
            estimated_bytes: bytes,
            cap,
        });
    }
    Ok(RequestMessageSizeDecision::Reject(
        RequestMessageSizeWarning {
            relay_url: relay_url.into(),
            estimated_bytes: bytes,
            active_cap: cap,
            cap_source,
        },
    ))
}

fn active_cap(relay_max_message_length: Option<usize>) -> (usize, RequestMessageSizeCapSource) {
    let app_cap = app_max_req_message_bytes();
    match relay_max_message_length {
        Some(relay_cap) if relay_cap < app_cap => (relay_cap, RequestMessageSizeCapSource::Nip11),
        _ => (app_cap, RequestMessageSizeCapSource::App),
    }
}
