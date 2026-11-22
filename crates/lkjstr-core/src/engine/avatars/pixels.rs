//! Classify the bounded canvas read once; a uniform default frame is not a cached face.
use super::{EDGE, UNIFORM_RANGE};
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Pixels {
    pub uniform: bool,
    pub opaque: bool,
}
/// The effects layer supplies RGBA from the cropped canvas, never the full original image.
pub fn classify(rgba: &[u8]) -> Option<Pixels> {
    if rgba.is_empty() || !rgba.len().is_multiple_of(4) || rgba.len() > (EDGE * EDGE * 4) as usize {
        return None;
    }
    let mut low = [255_u8; 4];
    let mut high = [0_u8; 4];
    for pixel in rgba.chunks_exact(4) {
        for channel in 0..4 {
            low[channel] = low[channel].min(pixel[channel]);
            high[channel] = high[channel].max(pixel[channel]);
        }
    }
    Some(Pixels {
        uniform: (0..4).all(|channel| high[channel] - low[channel] <= UNIFORM_RANGE),
        opaque: low[3] == 255,
    })
}
/// The smaller dimension controls the square; never enlarge the decoded source.
pub fn edge(width: u32, height: u32) -> Option<u32> {
    let edge = width.min(height).min(EDGE);
    (edge > 0).then_some(edge)
}
