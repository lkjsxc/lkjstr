use super::super::{MAX_MSAT, Phase};
use super::Total;
impl Total {
    pub(super) fn from_sum(amount: u128, receipts: usize, unverified: usize, phase: Phase) -> Self {
        let sats = amount / 1000;
        Self {
            amount_msat: amount.to_string(),
            sats: sats.min(u128::from(MAX_MSAT)) as u64,
            receipts,
            unverified,
            phase,
            limited: sats > u128::from(MAX_MSAT) || !amount.is_multiple_of(1000),
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fractions_are_summed_before_numeric_sats_and_remain_an_honest_lower_bound() {
        let fractional = Total::from_sum(1999, 1, 0, Phase::Ready);
        assert_eq!(
            (
                fractional.sats,
                fractional.amount_msat.as_str(),
                fractional.limited
            ),
            (1, "1999", true)
        );
        let carried = Total::from_sum([1999_u128, 1].into_iter().sum(), 2, 0, Phase::Ready);
        assert_eq!(
            (carried.sats, carried.amount_msat.as_str(), carried.limited),
            (2, "2000", false)
        );
    }
    #[test]
    fn maximal_valid_receipt_amounts_keep_the_exact_sum_above_the_js_integer_limit() {
        // Each receipt is individually permitted; the aggregate is not a JS number.
        let sum = std::iter::repeat_n(u128::from(MAX_MSAT), 1001).sum();
        let total = Total::from_sum(sum, 1001, 0, Phase::Ready);
        assert_eq!(total.amount_msat, "9016206453995731991");
        assert_eq!(total.sats, 9_007_199_254_740_991);
        assert!(total.limited);
        assert_eq!(total.receipts, 1001);
    }
    #[test]
    fn exact_numeric_boundary_and_one_msat_above_are_distinguished() {
        let boundary = u128::from(MAX_MSAT) * 1000;
        let exact = Total::from_sum(boundary, 1000, 0, Phase::Ready);
        assert!(!exact.limited);
        for extra in [1, 1000] {
            let above = Total::from_sum(boundary + extra, 1001, 0, Phase::Ready);
            assert_eq!(above.sats, MAX_MSAT);
            assert!(above.limited);
            assert_eq!(above.amount_msat, (boundary + extra).to_string());
        }
    }
}
