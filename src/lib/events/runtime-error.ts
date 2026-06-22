import { productSafeErrorMessage } from '$lib/rust-wasm/bridge-unavailable';

export function boundedErrorText(error: unknown): string {
  const message = productSafeErrorMessage(error, 'Operation failed.');
  return message.slice(0, 180) || 'Operation failed.';
}
