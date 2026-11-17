import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { installReadonly } from './race-guard.mjs';
test('candidate boundary rejects before constructing a socket and keeps read-only publication guard',()=>{
  const opened=[];
  function Socket(url){opened.push(url);this.addEventListener=()=>{}}
  Socket.prototype.send=()=>{};
  const context={WebSocket:Socket,URL,Blob,Map,Set,Error,JSON,Proxy,Reflect,performance:{timeOrigin:1,now:()=>1}};
  runInNewContext('('+installReadonly.toString()+')({relayAllowlist:["wss://allowed.test/"]})',context);
  const socket=new context.WebSocket('wss://allowed.test');
  socket.send(JSON.stringify(['REQ','one',{}]));
  assert.throws(()=>new context.WebSocket('wss://outside.test/'),/candidate scope/);
  assert.throws(()=>socket.send(JSON.stringify(['EVENT',{}])),/read requests/);
  assert.equal(opened.length,1);assert.equal(context.__openRaceGuard.deniedConnections,1);
  assert.deepEqual([...context.__openRaceGuard.deniedUrls],['wss://outside.test/']);
});
test('worker trampoline carries the exact candidate scope before importing original code',()=>{
  const blobs=[];function Worker(){this.addEventListener=()=>{}}
  const context={Worker,URL:class extends URL{static createObjectURL(blob){blobs.push(blob);return 'blob:fixture'}},
    Blob:class{constructor(parts){this.parts=parts}},Map,Set,Error,JSON,Proxy,Reflect,
    location:{href:'https://app.test/',origin:'https://app.test'},performance:{timeOrigin:1,now:()=>1}};
  runInNewContext('('+installReadonly.toString()+')({relayAllowlist:["wss://allowed.test/"]})',context);
  new context.Worker('https://app.test/engine.js',{type:'module'});
  assert.match(blobs[0].parts[0],/"relayAllowlist":\["wss:\/\/allowed.test\/"\]/);
  assert.ok(blobs[0].parts[0].indexOf('relayAllowlist')>=0);
});
