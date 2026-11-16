// Signed loopback challenge fixture. URLs and raw RPC ids are never written to reports.
import { listFixture } from './engine-private-list-fixture.mjs';
export async function authorizationFixture() {
  const native = await listFixture(), held = new Map(), sockets = new Set();
  let methods = new Set(), serial = 0, origin;
  const calls = [], errors = [];
  async function challenge(id, url) {
    const item = held.get(id); if (!item || item.socket.readyState !== 1) return false;
    const reply = await native.call({rpc:item.request,auth_url:url});
    item.socket.send(JSON.stringify(['EVENT',item.sub,reply.event]));return true;
  }
  return {
    native, calls, errors, first:native.first,
    configure(base, next) { origin=base; methods=new Set(next); },
    relay(socket) {
      sockets.add(socket);socket.on('close',()=>sockets.delete(socket));let sub;
      socket.on('message',raw=>{
        const message=JSON.parse(String(raw));
        if(message[0]==='REQ')sub=message[1];
        if(message[0]!=='EVENT')return;
        const selected=new Set(methods);
        void native.call({rpc:message[1]}).then(async reply=>{
          if(calls.length>=256)throw Error('bounded auth fixture overflow');
          const id=++serial;calls.push({id,method:reply.method});
          if(selected.has(reply.method)) {
            if(held.size>=32)throw Error('bounded held auth fixture overflow');
            held.set(id,{socket,sub,request:message[1],reply:reply.event});
            await challenge(id,origin+'/authorize?fixture='+id);
          } else if(socket.readyState===1)socket.send(JSON.stringify(['EVENT',sub,reply.event]));
        }).catch(()=>{errors.push('owned fixture failed');socket.close();});
      });
    },
    challenge,
    release(id) {
      const item=held.get(id);if(!item)return false;held.delete(id);
      if(item.socket.readyState!==1)return false;
      item.socket.send(JSON.stringify(['EVENT',item.sub,item.reply]));return true;
    },
    pending:()=>[...held.keys()],
    open:id=>held.get(id)?.socket.readyState===1,
    connections:()=>sockets.size,
    async close() {
      for(const socket of sockets)socket.close();held.clear();await native.close();
    },
  };
}
