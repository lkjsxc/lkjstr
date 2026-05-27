import type { Demand, DemandVisibility } from './demand-types';
import { demandFingerprintInput } from './compatible';
import { leaseFingerprint } from './lease-fingerprint';
import { setOrchestrationGauge } from './metrics';

type DemandRecord = {
  readonly demand: Demand;
  readonly fingerprint: string;
};

export type DemandRegistry = ReturnType<typeof createDemandRegistry>;

export function createDemandRegistry() {
  const byOwner = new Map<string, Set<string>>();
  const byFingerprint = new Map<string, Map<string, DemandRecord>>();

  const syncGauges = (): void => {
    let demands = 0;
    let leases = 0;
    for (const owners of byFingerprint.values()) {
      if (owners.size > 0) leases += 1;
      demands += owners.size;
    }
    setOrchestrationGauge('activeDemands', demands);
    setOrchestrationGauge('activeLeases', leases);
  };

  return {
    register(demand: Demand): string {
      const fingerprint = leaseFingerprint(demandFingerprintInput(demand));
      const owners =
        byFingerprint.get(fingerprint) ?? new Map<string, DemandRecord>();
      owners.set(demand.owner, { demand, fingerprint });
      byFingerprint.set(fingerprint, owners);
      const ownerSet = byOwner.get(demand.owner) ?? new Set<string>();
      ownerSet.add(fingerprint);
      byOwner.set(demand.owner, ownerSet);
      syncGauges();
      return fingerprint;
    },
    release(owner: string, fingerprint: string): void {
      const owners = byFingerprint.get(fingerprint);
      owners?.delete(owner);
      if (owners && owners.size === 0) byFingerprint.delete(fingerprint);
      const ownerSet = byOwner.get(owner);
      ownerSet?.delete(fingerprint);
      if (ownerSet && ownerSet.size === 0) byOwner.delete(owner);
      syncGauges();
    },
    releaseOwner(owner: string): void {
      const fingerprints = [...(byOwner.get(owner) ?? [])];
      for (const fingerprint of fingerprints) {
        this.release(owner, fingerprint);
      }
    },
    setOwnerVisibility(owner: string, visibility: DemandVisibility): void {
      for (const fingerprint of byOwner.get(owner) ?? []) {
        const record = byFingerprint.get(fingerprint)?.get(owner);
        if (!record) continue;
        byFingerprint.get(fingerprint)?.set(owner, {
          demand: { ...record.demand, visibility },
          fingerprint,
        });
      }
    },
    ownersFor(fingerprint: string): readonly Demand[] {
      const owners = byFingerprint.get(fingerprint);
      if (!owners) return [];
      return [...owners.values()].map((record) => record.demand);
    },
    visibleOwnerCount(fingerprint: string): number {
      return this.ownersFor(fingerprint).filter(
        (demand) => demand.visibility === 'visible',
      ).length;
    },
    hasOwners(fingerprint: string): boolean {
      return (byFingerprint.get(fingerprint)?.size ?? 0) > 0;
    },
    fingerprintsForOwner(owner: string): readonly string[] {
      return [...(byOwner.get(owner) ?? [])];
    },
    demandForOwner(owner: string, fingerprint: string): Demand | undefined {
      return byFingerprint.get(fingerprint)?.get(owner)?.demand;
    },
  };
}
