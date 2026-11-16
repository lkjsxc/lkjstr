#![allow(clippy::unwrap_used)]
use super::common;
use common::*;
use lkjstr_core::engine::zaps::*;
#[test]
fn failed_or_unsupported_discovery_keeps_notification_evidence_unknown_until_recovery() {
    for error in [Failure::Network, Failure::Unsupported] {
        let (mut store, ready_providers, target) = setup();
        let raw = common::receipt(&prepared(&store, &ready_providers, &target, 100), 110);
        let id = raw.id.clone();
        store.insert(raw, None);
        let mut providers = Providers::default();
        let mut receipts = Receipts::default();
        let job = providers
            .sync(&store, &[key(2).public_key()], 110)
            .unwrap()
            .fetch
            .remove(0);
        assert_eq!(
            receipts.evidence(&store, &providers, [id.as_str()], 110),
            Evidence {
                phase: Phase::Loading,
                unverified: 1,
                read_limited: false
            }
        );
        assert!(providers.complete(&store, &job, Err(error), 111));
        receipts
            .sync(&store, &providers, std::slice::from_ref(&id), 111)
            .unwrap();
        let evidence = receipts.evidence(&store, &providers, [id.as_str()], 111);
        assert_eq!(evidence.unverified, 1);
        assert_eq!(evidence.phase, error.phase());
        assert_eq!(receipts.total(&store, &providers, &target, 111).sats, 0);
        let job = providers
            .sync(&store, &[key(2).public_key()], 171)
            .unwrap()
            .fetch
            .remove(0);
        assert!(providers.complete(&store, &job, Ok(response(&job.binding, 4)), 171));
        receipts
            .sync(&store, &providers, std::slice::from_ref(&id), 171)
            .unwrap();
        receipts.advance(&store, &providers, 171, 4);
        assert_eq!(
            receipts.evidence(&store, &providers, [id.as_str()], 171),
            Evidence {
                phase: Phase::Ready,
                unverified: 0,
                read_limited: false
            }
        );
        assert_eq!(receipts.total(&store, &providers, &target, 171).sats, 21);
    }
}
