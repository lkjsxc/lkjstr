const BECH32_CHARS: &str = "023456789acdefghjklmnpqrstuvwxyz";

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct NpubPrefix {
    pub prefix: String,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct NpubPrefixError {
    pub message: String,
}

pub fn parse_npub_prefix(input: &str) -> Result<NpubPrefix, NpubPrefixError> {
    let prefix = input
        .trim()
        .to_ascii_lowercase()
        .strip_prefix("npub1")
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| input.trim().to_ascii_lowercase());
    if prefix.is_empty() {
        return Err(message("Enter a prefix after npub1."));
    }
    if prefix.len() > 8 {
        return Err(message("Use 8 characters or fewer for CPU mining."));
    }
    if prefix
        .chars()
        .any(|character| !BECH32_CHARS.contains(character))
    {
        return Err(message("Use valid npub characters only."));
    }
    Ok(NpubPrefix { prefix })
}

pub fn npub_matches_prefix(npub: &str, prefix: &str) -> bool {
    npub.to_ascii_lowercase()
        .starts_with(&format!("npub1{}", prefix.to_ascii_lowercase()))
}

pub fn estimated_attempts(prefix: &str) -> u64 {
    BECH32_CHARS.len().pow(prefix.len() as u32) as u64
}

fn message(message: &str) -> NpubPrefixError {
    NpubPrefixError {
        message: message.to_owned(),
    }
}
