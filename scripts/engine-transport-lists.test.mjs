import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture,deliver} from './engine-transport-fixture.mjs';
const query={source:'mutes',account:'a'.repeat(64),privateLists:true};
test('private-list replay restores hidden state in the first ordinary open',()=>{
  fixture((transport,port)=>{
    transport.post({t:'open',sub:'list',query,visible:false});
    transport.post({t:'hint',hint:{visibleSubs:[],pageHidden:false,idle:false,saveData:false}});
    port.sent.length=0;deliver(port,{t:'ready',version:9,engine:'fixture'});
    const open=port.sent.find(m=>m.t==='open');
    assert.equal(open.visible,false);assert.deepEqual(open.query,query);
    assert.equal(port.sent[0].t,'hint');
    transport.post({t:'hint',hint:{visibleSubs:['list'],pageHidden:false,idle:false,saveData:false}});
    port.sent.length=0;deliver(port,{t:'ready',version:9,engine:'fixture'});
    assert.equal(port.sent.find(m=>m.t==='open').visible,true);
  });
});
test('actual hidden document overrides a stale visible replay hint before crypto demand',()=>{
  fixture((transport,port,_state,set)=>{
    transport.post({t:'open',sub:'list',query,visible:true});
    transport.post({t:'hint',hint:{visibleSubs:['list'],pageHidden:false,idle:false,saveData:false}});
    document.visibilityState='hidden';
    port.sent.length=0;deliver(port,{t:'ready',version:9,engine:'fixture'});
    assert.equal(port.sent[0].t,'hint');assert.equal(port.sent[0].hint.pageHidden,true);
    assert.equal(port.sent.find(m=>m.t==='open').visible,false);
  });
});
test('initial hidden open and close preserve opt-in without resurrecting a closed list',()=>{
  fixture((transport,port)=>{
    transport.post({t:'open',sub:'list',query,visible:false});
    port.sent.length=0;deliver(port,{t:'ready',version:9,engine:'fixture'});
    assert.deepEqual(port.sent,[{t:'open',sub:'list',query,visible:false}]);
    transport.post({t:'close',sub:'list'});port.sent.length=0;
    deliver(port,{t:'ready',version:9,engine:'fixture'});
    assert.equal(port.sent.some(m=>m.t==='open'),false);
  });
});
