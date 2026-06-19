import {
  readFeedGeometryDiagnostics,
  type FeedGeometryRuntimeDiagnostics,
} from './feed-geometry-diagnostics';
import {
  runtimeMemorySnapshot,
  type RuntimeMemorySnapshot,
} from './runtime-memory';
import { readUserTimelineDiagnostics } from './user-timeline-diagnostics';

export async function readRuntimeDiagnostics(
  fallback: RuntimeMemorySnapshot,
): Promise<RuntimeMemorySnapshot> {
  const [feedGeometry, userTimeline] = await Promise.all([
    readFeedGeometryDiagnostics().catch(() => fallback.geometry.rust),
    readUserTimelineDiagnostics().catch(() => fallback.userTimeline),
  ]);
  return runtimeMemorySnapshot(userTimeline, feedGeometry);
}

export type RuntimeFeedGeometryDiagnostics = FeedGeometryRuntimeDiagnostics;
