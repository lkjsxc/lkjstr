use lkjstr_protocol::normalize_relay_url;

pub type ReadSurface = String;
pub type ReadPhase = String;
pub type ReadDirection = String;
pub type ReadPurpose = String;

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct RelayReadScoreKey {
    pub relay_url: String,
    pub surface: ReadSurface,
    pub phase: ReadPhase,
    pub direction: ReadDirection,
    pub route_group_key: String,
    pub filter_shape: String,
    pub purpose: ReadPurpose,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RelayReadScoreKeyInput {
    pub relay_url: String,
    pub surface: ReadSurface,
    pub phase: ReadPhase,
    pub direction: ReadDirection,
    pub route_group_key: String,
    pub filter_shape: String,
    pub purpose: ReadPurpose,
}

impl RelayReadScoreKey {
    pub fn normalized(input: RelayReadScoreKeyInput) -> Option<Self> {
        let relay_url = normalize_relay_url(&input.relay_url)?;
        Some(Self {
            relay_url,
            surface: input.surface,
            phase: input.phase,
            direction: input.direction,
            route_group_key: input.route_group_key,
            filter_shape: normalize_filter_shape(&input.filter_shape),
            purpose: input.purpose,
        })
    }
}

pub fn score_key_id(key: &RelayReadScoreKey) -> String {
    [
        key.relay_url.as_str(),
        key.surface.as_str(),
        key.phase.as_str(),
        key.direction.as_str(),
        key.route_group_key.as_str(),
        key.filter_shape.as_str(),
        key.purpose.as_str(),
    ]
    .join("\u{1f}")
}

pub fn normalize_filter_shape(raw: &str) -> String {
    let trimmed = raw.trim();
    match serde_json::from_str::<serde_json::Value>(trimmed) {
        Ok(value) => value.to_string(),
        Err(_) => trimmed.to_owned(),
    }
}
