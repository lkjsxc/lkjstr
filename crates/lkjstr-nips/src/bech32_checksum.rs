//! Original Bech32 checksum parameters with caller-enforced protocol limits.
use bech32::{Bech32, Checksum};

// Only the accepted length changes. The polynomial, six checksum characters,
// and original Bech32 residue remain unchanged (never Bech32m).
// Longer messages do not inherit Bech32's short-code error-detection guarantees.
pub(crate) struct ProtocolBech32<const LIMIT: usize>;

impl<const LIMIT: usize> Checksum for ProtocolBech32<LIMIT> {
    type MidstateRepr = <Bech32 as Checksum>::MidstateRepr;
    const CODE_LENGTH: usize = LIMIT;
    const CHECKSUM_LENGTH: usize = Bech32::CHECKSUM_LENGTH;
    const GENERATOR_SH: [Self::MidstateRepr; 5] = Bech32::GENERATOR_SH;
    const TARGET_RESIDUE: Self::MidstateRepr = Bech32::TARGET_RESIDUE;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checksum_parameters_are_consistent() {
        ProtocolBech32::<5000>::sanity_check();
        ProtocolBech32::<16384>::sanity_check();
    }
}
