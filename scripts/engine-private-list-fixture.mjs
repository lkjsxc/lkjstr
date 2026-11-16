// Fresh native signer, kept alive only for this loopback run. No plaintext scalar is returned.
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {resolve,join} from 'node:path';
async function bounded(promise,ms=15000) {
  let timer;try{return await Promise.race([promise,new Promise((_,bad)=>{
    timer=setTimeout(()=>bad(Error('private-list fixture timeout')),ms);
  })]);}finally{clearTimeout(timer);}
}
export async function listFixture(){
  const child=spawn(process.env.LKJSTR_LIST_FIXTURE_BIN??join(resolve(process.env.CARGO_TARGET_DIR??'target'),'debug/examples/list-fixtures'),[],
    {stdio:['pipe','pipe','pipe']});
  child.stderr.resume();
  const ended=new Promise(ok=>child.once('close',ok));
  const failed=new Promise((_,bad)=>child.once('error',bad));
  const lines=createInterface({input:child.stdout})[Symbol.asyncIterator]();
  let chain=Promise.resolve(),mode={},first;
  const sockets=new Set(),held=[],calls=[];
  const call=input=>{
    const result=chain.then(async()=>{child.stdin.write(JSON.stringify(input)+'\n');
      const line=await bounded(lines.next());if(line.done)throw Error('private-list helper stopped');
      return JSON.parse(line.value);});
    chain=result.catch(()=>{});return result;
  };
  const close=async()=>{
    for(const socket of sockets)socket.close();
    held.length=0;
    try{await bounded(chain,2000);}catch{}
    child.stdin.end();
    try{await bounded(ended,2000);}catch{child.kill('SIGTERM');await bounded(ended,2000);}
  };
  try{first=JSON.parse((await bounded(Promise.race([lines.next(),failed]))).value);}catch(error){await close();throw error;}
  return {first,call,calls,mode:value=>{mode=value;},close,
    relay(socket){
      sockets.add(socket);socket.on('close',()=>sockets.delete(socket));let sub;
      socket.on('message',raw=>{
        const message=JSON.parse(String(raw));
        if(message[0]==='REQ')sub=message[1];
        if(message[0]!=='EVENT')return;
        const selected={...mode};
        void call({rpc:message[1],error:selected.error}).then(reply=>{
          if(calls.length>=512)throw Error('bounded private-list RPC overflow');
          calls.push({method:reply.method,at:Date.now()});
          const envelope=JSON.stringify(['EVENT',sub,reply.event]);
          if(selected.hold && reply.method.endsWith('_decrypt'))held.push({socket,envelope});
          else if(socket.readyState===1)socket.send(envelope);
        }).catch(()=>socket.close());
      });
    },
    release(){
      for(const {socket,envelope} of held.splice(0))if(socket.readyState===1)socket.send(envelope);
    }
  };
}
