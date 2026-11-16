import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliver, fixture } from './engine-transport-fixture.mjs';
const challenge = { t: 'signer.auth', id: 'owned-handle', peer: 'a'.repeat(64),
  method: 'sign_event', url: 'https://signer.invalid/authorize?token=do-not-broadcast', expiresAt: Date.now() + 60000 };

test('SharedWorker authorization remains on its exact private port', () => fixture((transport, port) => {
  const messages=[]; transport.listen(m=>messages.push(m));
  deliver(port, challenge);
  assert.deepEqual(messages, [challenge]);
  transport.post({t:'signer.auth.cancel', id:challenge.id});
  assert.deepEqual(port.sent.at(-1), {t:'signer.auth.cancel', id:challenge.id});
}));
test('fallback follower authorization URL never enters BroadcastChannel serialization', () => fixture((transport, _port, state) => {
  void state.lead(); const channel = state.channels[0];
  deliver(channel, {hello:true, from:'follower', join:'join-1'});
  const follower = state.pairs[1].port1;
  const count = channel.sent.length;
  deliver(follower, challenge);
  assert.equal(channel.sent.length, count);
  assert.deepEqual(follower.sent.at(-1), {t:'signer.auth.cancel',id:challenge.id,reason:'unsupported'});
  assert.equal(JSON.stringify(channel.sent).includes(challenge.url), false);
  deliver(follower, {t:'signer.auth.clear',id:challenge.id});
  assert.equal(channel.sent.at(-1).msg.t,'signer.auth.clear');
}, true));
test('fallback leader own authorization uses its direct port without broadcast', () => fixture((transport, _port, state) => {
  const messages=[];transport.listen(m=>messages.push(m));void state.lead();
  const channel=state.channels[0],count=channel.sent.length;
  deliver(state.pairs[0].port1,challenge);
  assert.deepEqual(messages.filter(m=>m.t==='signer.auth'),[challenge]);
  assert.equal(channel.sent.length,count);
}, true));
test('a retired connection cannot revive an old authorization URL', () => fixture((transport, first, state) => {
  const messages=[];transport.listen(m=>messages.push(m));
  const retired=first.onmessage;state.workers[0].onerror();
  retired({data:challenge});
  assert.equal(messages.some(m=>m.t==='signer.auth'),false);
}));
