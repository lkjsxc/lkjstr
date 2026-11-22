//! Public avatar ownership and disposable cache policy; browser effects stay in the Worker.
pub mod cache;
pub mod jobs;
pub mod pixels;
pub const EDGE: u32 = 160;
pub const UNIFORM_RANGE: u8 = 4;
pub const MAX_URL_BYTES: usize = 2048;
pub const MAX_ORIGINAL_BYTES: u64 = 2 * 1024 * 1024;
pub const MAX_DERIVED_BYTES: u64 = 128 * 1024;

/// Keep the exact supplied URL as identity; only hostname scheduling uses normalization.
pub fn host(key: &str) -> Option<String> {
    if !key
        .get(..8)
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case("https://"))
        || key[8..].starts_with(['/', '\\'])
        || key.contains('\\')
        || key.len() > MAX_URL_BYTES
        || key.chars().any(|c| c.is_control() || c.is_whitespace())
    {
        return None;
    }
    let parsed = url::Url::parse(key).ok()?;
    (parsed.scheme() == "https" && parsed.username().is_empty() && parsed.password().is_none())
        .then(|| parsed.host_str().map(str::to_owned))
        .flatten()
}
