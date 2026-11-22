import { createHash } from 'node:crypto';

const MAX_SOCKETS = 64;
const MAX_WIRES = 4096;
const MAX_FRAME_BYTES = 1024 * 1024;
const fixturePaths = new Set(['/', '/owner', '/deep-links', '/visitor', '/wish']);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const kindOf = (kind) => (['REQ', 'CLOSE', 'EVENT', 'AUTH'].includes(kind) ? kind : 'other');
const isFilter = (filter) => filter && typeof filter === 'object' && !Array.isArray(filter);

function pathLabel(url) {
  return fixturePaths.has(url)
    ? { path: url, pathId: url }
    : { path: '<other>', pathId: hash(url ?? '').slice(0, 16) };
}

function pathSummary(sockets, activatedAtMs, sealedAtMs) {
  let overlapPairs = 0;
  let maxOverlapMs = 0;
  let comparableWires = 0;
  let regressed = false;
  const receiveInterleave = [];
  let previous;
  for (const [index, newer] of sockets.entries()) {
    if (newer.wire.min !== null) {
      if (previous) {
        comparableWires++;
        regressed ||= newer.wire.min < previous.wire.max;
      }
      previous = newer;
    }
    for (const older of sockets.slice(0, index)) {
      const end = Math.min(older.closedAtMs ?? sealedAtMs, newer.closedAtMs ?? sealedAtMs);
      const start = Math.max(activatedAtMs, newer.openedAtMs);
      if (end > start) {
        overlapPairs++;
        maxOverlapMs = Math.max(maxOverlapMs, end - start);
      }
      if (newer.firstFrame && older.lastFrame?.sequence > newer.firstFrame.sequence) {
        receiveInterleave.push({ older: older.id, newer: newer.id });
      }
    }
  }
  return {
    overlapPairs,
    maxOverlapMs,
    receiveInterleave,
    succession: comparableWires === 0 ? 'insufficient' : regressed ? 'regressed' : 'monotone',
  };
}

export function createSocketTrace(now = () => performance.now()) {
  // Before activation, metadata follows the fixture's live sockets and holds no socket references.
  const pending = new WeakMap();
  // The window retains at most MAX_SOCKETS rows and MAX_WIRES numeric IDs across all paths.
  const sockets = [];
  const live = new Map();
  const paths = new Map();
  const loss = new Set();
  const duplicateWires = new Map();
  let nextId = 0;
  let sequence = 0;
  let wireCount = 0;
  let droppedSockets = 0;
  let unparsedFrames = 0;
  let activatedAtMs = null;
  let secondTabAtMs = null;
  let settleStartedAtMs = null;
  let sealedAtMs = null;
  let needle;
  let unexpectedPath = false;

  function capture(socket, info, openAtActivation) {
    if (!info || live.has(socket)) {
      loss.add('socket-lifecycle');
      return;
    }
    unexpectedPath ||= info.path !== '/' && info.path !== '/owner';
    if (sockets.length === MAX_SOCKETS) {
      droppedSockets++;
      loss.add('socket-limit');
      return;
    }
    if (!info.host || !info.keyHash) loss.add('handshake-metadata');
    const row = {
      ...info,
      openAtActivation,
      closedAtMs: null,
      frames: { REQ: 0, CLOSE: 0, EVENT: 0, AUTH: 0, other: 0 },
      firstFrame: null,
      lastFrame: null,
      wire: { min: null, max: null, count: 0, unparsed: 0 },
      needleCount: 0,
    };
    if (!paths.has(row.pathId)) {
      paths.set(row.pathId, { path: row.path, sockets: [], live: 0, peak: 0, wires: new Map() });
    }
    const path = paths.get(row.pathId);
    path.sockets.push(row);
    path.live++;
    path.peak = Math.max(path.peak, path.live);
    sockets.push(row);
    live.set(socket, row);
  }

  function recordReq(row, wireId, filters) {
    if (needle !== undefined && filters.some((filter) => filter.search === needle)) {
      row.needleCount++;
    }
    const match = /^(?:w|delivery-)(\d+)$/.exec(wireId);
    const number = match ? Number(match[1]) : NaN;
    if (!Number.isSafeInteger(number)) {
      row.wire.unparsed++;
      return;
    }
    row.wire.min = Math.min(row.wire.min ?? number, number);
    row.wire.max = Math.max(row.wire.max ?? number, number);
    row.wire.count++;
    const wires = paths.get(row.pathId).wires;
    const first = wires.get(number);
    if (first === undefined) {
      if (wireCount === MAX_WIRES) loss.add('wire-id-limit');
      else {
        wires.set(number, row.id);
        wireCount++;
      }
    } else if (first !== row.id) {
      const key = `${row.pathId}:${number}`;
      if (!duplicateWires.has(key)) {
        duplicateWires.set(key, {
          path: row.path,
          pathId: row.pathId,
          number,
          first,
          next: row.id,
        });
      }
    }
  }

  function frame(socket, raw, binary = false) {
    if (sealedAtMs !== null) return;
    if (activatedAtMs === null) {
      const info = pending.get(socket);
      if (info) info.framesBeforeActivation++;
      return;
    }
    const row = live.get(socket);
    if (!row) {
      if (!loss.has('socket-limit')) loss.add('socket-lifecycle');
      return;
    }
    const received = { atMs: now(), sequence: ++sequence };
    row.firstFrame ??= received;
    row.lastFrame = received;
    let message;
    if (!binary && Buffer.byteLength(raw) <= MAX_FRAME_BYTES) {
      try {
        message = JSON.parse(String(raw));
      } catch {
        // Record the gap without retaining frame contents.
      }
    }
    if (!Array.isArray(message) || typeof message[0] !== 'string') {
      unparsedFrames++;
      loss.add('frame-parse');
      return;
    }
    const kind = kindOf(message[0]);
    row.frames[kind]++;
    if (kind !== 'REQ') return;
    const [, wireId, ...filters] = message;
    if (typeof wireId !== 'string' || filters.length === 0 || !filters.every(isFilter)) {
      unparsedFrames++;
      loss.add('frame-parse');
      return;
    }
    recordReq(row, wireId, filters);
  }

  function settled() {
    return [...paths.values()].every((path) => path.live <= 1);
  }

  return {
    open(socket, req) {
      if (sealedAtMs !== null) return;
      const key = req.headers['sec-websocket-key'];
      const info = {
        id: ++nextId,
        ...pathLabel(req.url),
        host: req.headers.host?.slice(0, 255) ?? null,
        keyHash: key ? hash(key).slice(0, 16) : null,
        openedAtMs: now(),
        framesBeforeActivation: 0,
      };
      pending.set(socket, info);
      if (activatedAtMs !== null) capture(socket, info, false);
    },
    frame,
    close(socket) {
      pending.delete(socket);
      if (activatedAtMs === null || sealedAtMs !== null) return;
      const row = live.get(socket);
      if (!row) {
        if (!loss.has('socket-limit')) loss.add('socket-lifecycle');
        return;
      }
      row.closedAtMs = now();
      paths.get(row.pathId).live--;
      live.delete(socket);
    },
    activate(expectedLive) {
      activatedAtMs = now();
      for (const socket of expectedLive) {
        // The fixture enumerates open sockets in accept order.
        capture(socket, pending.get(socket), true);
      }
    },
    secondTab() {
      secondTabAtMs = now();
    },
    setNeedle(value) {
      needle = value;
    },
    startSettling() {
      settleStartedAtMs = now();
    },
    settled,
    unexpectedPath: () => unexpectedPath,
    seal(expectedLive, complete) {
      sealedAtMs = now();
      if (
        !complete ||
        activatedAtMs === null ||
        secondTabAtMs === null ||
        settleStartedAtMs === null
      )
        loss.add('window-incomplete');
      if (
        !loss.has('socket-limit') &&
        (expectedLive.length !== live.size || expectedLive.some((socket) => !live.has(socket)))
      ) {
        loss.add('socket-lifecycle');
      }
      live.clear();
    },
    judge() {
      const needleSockets = sockets.filter((socket) => socket.needleCount > 0).map(({ id }) => id);
      const reasons = [...loss];
      if (sealedAtMs === null) reasons.push('unsealed');
      else if (!loss.has('window-incomplete') && !settled()) reasons.push('settled-duplicate');
      if (!needleSockets.length) reasons.push('main-needle-missing');
      const end = sealedAtMs ?? now();
      return {
        ok: reasons.length === 0,
        reasons,
        activatedAtMs,
        secondTabAtMs,
        sealedAtMs,
        settleWaitMs: settleStartedAtMs === null ? null : end - settleStartedAtMs,
        needleSockets,
        droppedSockets,
        unparsedFrames,
        paths: [...paths].map(([pathId, path]) => ({
          pathId,
          path: path.path,
          peak: path.peak,
          live: path.live,
          ...pathSummary(path.sockets, activatedAtMs, end),
        })),
        duplicateWires: [...duplicateWires.values()],
        sockets,
      };
    },
  };
}
