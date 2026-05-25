import {
  decMemoryCounter,
  incMemoryCounter,
  setMemoryCounter,
} from './memory-counters';
import { reportFeedRuntimeWindowSize } from './memory-debug';

export function trackTabRuntimeOpened(): void {
  incMemoryCounter('active-tab-runtimes');
}

export function trackTabRuntimeClosed(): void {
  decMemoryCounter('active-tab-runtimes');
}

export function trackFeedWindowSize(size: number): void {
  reportFeedRuntimeWindowSize(size);
}

export function trackNotificationRecords(count: number): void {
  setMemoryCounter('notification-runtime-record-count', Math.max(0, count));
}
