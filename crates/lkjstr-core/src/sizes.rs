//! Tile width classes and physical-pixel resize constraints.
#[derive(Debug, PartialEq, Eq)]
pub enum Width {
    Sliver,
    Narrow,
    Regular,
    Wide,
}
pub fn width(px: f64) -> Width {
    if px < 280.0 {
        Width::Sliver
    } else if px < 440.0 {
        Width::Narrow
    } else if px < 760.0 {
        Width::Regular
    } else {
        Width::Wide
    }
}
pub fn resized_pair(first: f64, pair: f64, delta: f64, horizontal: bool) -> f64 {
    let floor: f64 = if horizontal { 160.0 } else { 96.0 };
    (first + delta).clamp(floor.min(pair / 2.0), (pair - floor).max(pair / 2.0))
}
pub fn can_split(width: f64, height: f64, horizontal: bool) -> bool {
    width >= if horizontal { 320.0 } else { 160.0 }
        && height >= if horizontal { 96.0 } else { 192.0 }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn thresholds_and_physical_minima() {
        assert_eq!(width(200.0), Width::Sliver);
        assert_eq!(width(320.0), Width::Narrow);
        assert_eq!(width(520.0), Width::Regular);
        assert_eq!(width(900.0), Width::Wide);
        assert_eq!(resized_pair(400.0, 800.0, -999.0, true), 160.0);
        assert_eq!(resized_pair(200.0, 400.0, 999.0, false), 304.0);
        assert!(!can_split(319.0, 900.0, true));
        assert!(can_split(320.0, 96.0, true));
        assert!(!can_split(900.0, 191.0, false));
    }
}
