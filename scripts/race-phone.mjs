// Dedicated workers reject the legacy combined network/navigator override.
export const phoneNetwork = Object.freeze({ offline: false, latency: 150,
  downloadThroughput: 200000, uploadThroughput: 93750, connectionType: 'cellular4g' });
export async function throttlePhone(send, sessionId, type) {
  const { offline, ...conditions } = phoneNetwork;
  const result = await send('Network.emulateNetworkConditionsByRule', {
    offline, matchedNetworkConditions: [{ urlPattern: '', ...conditions }],
  }, sessionId);
  if (!Array.isArray(result.ruleIds) || result.ruleIds.length !== 1 || !result.ruleIds[0])
    throw Error('Phone network setup did not return a rule witness');
  // Dedicated-worker navigator state follows the owner; its explicit override is unsupported.
  if (type !== 'worker') await send('Network.overrideNetworkState', phoneNetwork, sessionId);
  if (type === 'page') await send('Emulation.setCPUThrottlingRate', { rate: 4 }, sessionId);
  return { method: 'Network.emulateNetworkConditionsByRule', ruleIds: result.ruleIds,
    conditions: { ...phoneNetwork }, navigatorOverride: type === 'worker' ? 'owner-inherited-not-overridden' : 'explicit',
    cpuSlowdown: type === 'page' ? 4 : null };
}
