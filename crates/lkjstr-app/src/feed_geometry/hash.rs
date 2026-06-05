const FNV_OFFSET: u64 = 0xcbf29ce484222325;
const FNV_PRIME: u64 = 0x00000100000001b3;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContentShapeInput {
    pub content_length: u32,
    pub unicode_scalar_count: u32,
    pub line_break_count: u16,
    pub longest_unbroken_token_length: u32,
    pub url_count: u16,
    pub media_count: u16,
    pub reference_preview_count: u16,
    pub custom_emoji_count: u16,
    pub has_content_warning: bool,
    pub fragment_count: u16,
}

#[must_use]
pub fn content_shape_hash(input: &ContentShapeInput) -> String {
    let mut state = FNV_OFFSET;
    fold_u32(&mut state, input.content_length);
    fold_u32(&mut state, input.unicode_scalar_count);
    fold_u16(&mut state, input.line_break_count);
    fold_u32(&mut state, input.longest_unbroken_token_length);
    fold_u16(&mut state, input.url_count);
    fold_u16(&mut state, input.media_count);
    fold_u16(&mut state, input.reference_preview_count);
    fold_u16(&mut state, input.custom_emoji_count);
    fold_bool(&mut state, input.has_content_warning);
    fold_u16(&mut state, input.fragment_count);
    format!("{state:016x}")
}

fn fold_u32(state: &mut u64, value: u32) {
    for byte in value.to_le_bytes() {
        fold_byte(state, byte);
    }
}

fn fold_u16(state: &mut u64, value: u16) {
    for byte in value.to_le_bytes() {
        fold_byte(state, byte);
    }
}

fn fold_bool(state: &mut u64, value: bool) {
    fold_byte(state, u8::from(value));
}

fn fold_byte(state: &mut u64, byte: u8) {
    *state ^= u64::from(byte);
    *state = state.wrapping_mul(FNV_PRIME);
}
