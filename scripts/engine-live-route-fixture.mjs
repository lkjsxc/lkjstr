// Exact owned A/B/C replay: B had data, disconnects, then answers its resumed gap.
export function liveRoutes(events, trace) {
  const timers=new Set(),sockets=new Set(),errors=[];
  let disconnectedAt=null,recovery=null,newAvailable=false,newDeliveries=0,serial=0;
  const old=events[2],later=events[0];
  const head=f=>f.kinds?.length===2&&f.kinds.includes(1)&&f.kinds.includes(6)
    &&f.authors?.includes(old.pubkey)&&f.until===undefined&&!f.ids&&!f['#e']&&!f['#p'];
  const matches=(e,f)=>head(f)&&(f.since===undefined||e.created_at>=f.since);
  const send=(socket,entry,event)=>{
    if(socket.readyState!==1||!entry.filters.some(f=>matches(event,f)))return false;
    socket.send(JSON.stringify(['EVENT',entry.wire,event]));entry.sent.push({id:event.id,at:Date.now()});
    if(event.id===later.id)newDeliveries++;return true;
  };
  function route(socket,request) {
    const path=new URL(request.url,'http://fixture').pathname;
    const state={socket,path,serial:++serial,active:new Map()};sockets.add(state);
    socket.on('close',()=>{for(const q of state.active.values()){q.closedAt??=Date.now();q.closeReason??='socket-close';}state.active.clear();sockets.delete(state);});
    socket.on('message',raw=>{
      let msg;try{msg=JSON.parse(String(raw));}catch{errors.push('malformed fixture input');return;}
      if(msg[0]==='CLOSE'){const q=state.active.get(msg[1]);if(q){q.closedAt=Date.now();q.closeReason='client-close';}state.active.delete(msg[1]);return;}
      if(msg[0]!=='REQ'){errors.push('publication blocked by owned fixture');socket.close();return;}
      if(trace.length>=512){errors.push('request evidence bound');socket.close();return;}
      const entry={route:path,socket:state.serial,wire:msg[1],at:Date.now(),filters:msg.slice(2),sent:[],eoseAt:null};
      trace.push(entry);state.active.set(msg[1],entry);
      const isHome=entry.filters.some(head);
      if(path==='/b'&&isHome){send(socket,entry,old);if(newAvailable)send(socket,entry,later);}
      const timer=setTimeout(()=>{
        timers.delete(timer);
        if(socket.readyState!==1||state.active.get(entry.wire)!==entry)return;
        socket.send(JSON.stringify(['EOSE',entry.wire]));entry.eoseAt=Date.now();
        if(path==='/b'&&isHome&&disconnectedAt!==null)recovery=entry;
      },path==='/b'&&isHome?50:0);
      timers.add(timer);
    });
  }
  const heads=()=>[...sockets].flatMap(s=>[...s.active.values()].filter(q=>q.filters.some(head)));
  return {route,errors,old,later,heads,
    get recovery(){return recovery;},get disconnectedAt(){return disconnectedAt;},get newDeliveries(){return newDeliveries;},
    disconnect(){disconnectedAt=Date.now();for(const s of [...sockets])if(s.path==='/b')s.socket.terminate();},
    offer(){newAvailable=true;for(const s of sockets)if(s.path==='/b')for(const q of s.active.values())if(q.filters.some(head))send(s.socket,q,later);},
    close(){for(const timer of timers)clearTimeout(timer);timers.clear();for(const s of sockets)s.socket.terminate();},
    get openSockets(){return sockets.size;},
  };
}
