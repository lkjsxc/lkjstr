#![cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::JsValue;

pub fn install() -> Result<(), JsValue> {
    js_sys::eval(
        r#"
    window.__homeHistoryOriginal = window.WebSocket;
    const event = (id, time, content, kind = 1, pubkey = 'b') => ({
      id: id.repeat(64), pubkey: pubkey.repeat(64), created_at: time,
      kind, tags: [], content, sig: 'f'.repeat(128)
    });
    const follow = event('1', 90, '', 3, 'a');
    follow.tags = [['p', 'b'.repeat(64)]];
    const initial = event('2', 100, 'history initial note');
    const history = window.__homeHistory = { requests: [], pending: [], sockets: [] };
    history.flush = (empty) => {
      const events = empty ? [] : [
        initial, event('1', 100, 'rejected lower tied id'),
        event('6', 99, 'rejected author', 1, 'c'),
        event('7', 101, 'rejected future'), event('8', 99, 'rejected kind', 3),
        event('3', 100, 'history tied note'), event('4', 99, 'history older note')
      ];
      for (const {socket, sub} of history.pending.splice(0)) {
        for (const item of events) socket.onmessage?.({data: JSON.stringify(['EVENT', sub, item])});
        socket.onmessage?.({data: JSON.stringify(['EOSE', sub])});
      }
    };
    window.WebSocket = class {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        history.sockets.push(this);
        setTimeout(() => {
          if (this.readyState !== 0) return;
          this.readyState = 1;
          this.onopen?.({type: 'open'});
        }, 0);
      }
      send(message) {
        const frame = JSON.parse(message);
        if (frame[0] !== 'REQ') return;
        const sub = frame[1], filters = frame.slice(2);
        const isFollow = filters.some(f => f.kinds?.includes(3));
        if (!isFollow) history.requests.push({url: this.url, filters});
        if (!isFollow && filters.some(f => f.limit === 180)) {
          history.pending.push({socket: this, sub});
          return;
        }
        setTimeout(() => {
          this.onmessage?.({data: JSON.stringify(['EVENT', sub, isFollow ? follow : initial])});
          this.onmessage?.({data: JSON.stringify(['EOSE', sub])});
        }, 0);
      }
      close() { this.readyState = 3; this.onclose?.({type: 'close'}); }
    };
    "#,
    )
    .map(|_| ())
}

pub fn restore() {
    let _ = js_sys::eval(
        r#"
      window.WebSocket = window.__homeHistoryOriginal;
      delete window.__homeHistoryOriginal;
      delete window.__homeHistory;
    "#,
    );
}

pub fn check(expression: &str) -> Result<(), JsValue> {
    if js_sys::eval(expression)?.as_bool() == Some(true) {
        return Ok(());
    }
    Err(js_sys::Error::new(expression).into())
}
