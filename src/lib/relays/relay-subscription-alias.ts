import {
  maxRelaySubscriptionIdLength,
  relaySubscriptionHash,
} from './subscription-id';

export type RelaySubscriptionAliases = ReturnType<
  typeof createRelaySubscriptionAliases
>;

export function createRelaySubscriptionAliases() {
  const logicalToWire = new Map<string, string>();
  const wireToLogical = new Map<string, string>();

  return {
    wireId: (logicalId: string, maxLength: number): string => {
      const existing = logicalToWire.get(logicalId);
      if (existing && existing.length <= maxLength) return existing;
      const wire =
        logicalId.length <= maxLength ? logicalId : alias(logicalId, maxLength);
      logicalToWire.set(logicalId, wire);
      wireToLogical.set(wire, logicalId);
      return wire;
    },
    logicalId: (wireId: string): string => wireToLogical.get(wireId) ?? wireId,
    forget: (logicalId: string): void => {
      const wire = logicalToWire.get(logicalId);
      logicalToWire.delete(logicalId);
      if (wire) wireToLogical.delete(wire);
    },
  };
}

function alias(logicalId: string, maxLength: number): string {
  const length = Math.max(8, Math.min(maxLength, maxRelaySubscriptionIdLength));
  return relaySubscriptionHash(logicalId, length);
}
