// Test-only correlation of real Worker calls; retain metadata rather than private snapshots.
export async function installDmWire(context, relayUrl) {
  await context.addInitScript((relay) => {
    if (location.protocol !== 'http:') return;
    const relays = JSON.stringify([{ url: relay, read: true, write: true, search: true }]);
    localStorage.setItem('lkjstr:relays:', relays);
    const pending = new Map(),
      saves = new Set(),
      editors = new Set(),
      registrations = new Map(),
      held = [];
    window.dmUi = {
      ready: null,
      accounts: null,
      saves: 0,
      saveFailures: 0,
      editors: 0,
      holdSaves: false,
      heldWrites: 0,
      flushes: [],
      events: [],
    };
    const observe = (port) => {
      window.dmUiPort = port;
      const trace = (event) => {
        window.dmUi.events.push(event);
        if (window.dmUi.events.length > 100) window.dmUi.events.shift();
      };
      const post = port.postMessage.bind(port);
      port.postMessage = (message, ...rest) => {
        if (['dm.open', 'dm.close', 'dm.visible', 'hint', 'act'].includes(message.t))
          trace({
            direction: 'in',
            t: message.t,
            req: message.req,
            sub: message.sub,
            action: message.action?.a,
            query: message.query,
            hint: message.hint,
            visible: message.visible,
          });
        if (message.t === 'act' && message.action?.a === 'dm.editor')
          registrations.set(message.req, {
            editor: message.action.editor,
            open: message.action.open,
          });
        if (message.t === 'act' && message.action?.a === 'dm.draft.save') {
          saves.add(message.req);
          if (window.dmUi.holdSaves && held.length < 1) {
            held.push(() => post(message, ...rest));
            window.dmUi.heldWrites = held.length;
            return;
          }
        }
        return post(message, ...rest);
      };
      port.addEventListener('message', ({ data: message }) => {
        const probe = window.dmUi.inboxProbe;
        if (message.t === 'dm' && probe?.sub === message.sub && probe.snapshots.length < 32)
          probe.snapshots.push({
            phase: message.snapshot.phase,
            error: message.snapshot.error,
            at: performance.now(),
          });
        if (['dm', 'result', 'dm.flush', 'status'].includes(message.t))
          trace({
            direction: 'out',
            t: message.t,
            req: message.req,
            sub: message.sub,
            ok: message.ok,
            error: message.error?.code ?? message.snapshot?.error,
            phase: message.phase ?? message.snapshot?.phase,
            account: message.snapshot?.account,
            blocked: message.snapshot?.blocked,
            connected: message.connected,
          });
        if (message.t === 'dm.flush') {
          window.dmUi.flushes.push({ req: message.req, phase: message.phase });
          if (window.dmUi.flushes.length > 16) window.dmUi.flushes.shift();
          if (message.phase === 'hold') {
            window.dmUi.holdSaves = false;
            for (const send of held.splice(0)) send();
            window.dmUi.heldWrites = 0;
          }
        }
        if (message.t === 'ready')
          window.dmUi.ready = { version: message.version, engine: message.engine };
        if (message.t === 'accounts') {
          window.dmUi.accounts = message;
          for (const account of message.accounts)
            localStorage.setItem(`lkjstr:relays:${account.author.pubkey}`, relays);
        }
        if (message.t !== 'result') return;
        const registration = registrations.get(message.req);
        if (registration) {
          registrations.delete(message.req);
          if (message.ok) {
            if (registration.open) editors.add(registration.editor);
            else editors.delete(registration.editor);
            window.dmUi.editors = editors.size;
          }
        }
        if (saves.delete(message.req)) {
          if (message.ok) window.dmUi.saves++;
          else window.dmUi.saveFailures++;
        }
        const reply = pending.get(message.req);
        if (reply) {
          pending.delete(message.req);
          reply(message);
        }
      });
    };
    const Shared = window.SharedWorker;
    if (Shared)
      window.SharedWorker = class extends Shared {
        constructor(...args) {
          super(...args);
          observe(this.port);
        }
      };
    const Worker = window.Worker;
    window.Worker = class extends Worker {
      constructor(...args) {
        super(...args);
        observe(this);
      }
    };
    window.dmUiAct = (action) =>
      new Promise((done) => {
        if (pending.size >= 16 || !window.dmUiPort)
          return done({ ok: false, error: { code: 'internal' } });
        const req = `private-ui-setup-${crypto.randomUUID()}`;
        const timer = setTimeout(() => {
          pending.delete(req);
          done({ ok: false, error: { code: 'internal' } });
        }, 45000);
        pending.set(req, (result) => {
          clearTimeout(timer);
          done(result);
        });
        window.dmUiPort.postMessage({ t: 'act', req, action });
      });
  }, relayUrl);
}
export const act = (page, action) => page.evaluate((value) => window.dmUiAct(value), action);
