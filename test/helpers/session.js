// Made-up shared sessions for the tests, as layersharedsession's session.js has them: what they
// share by its shared.js (last writer wins), their channels, and who joins, moves and leaves. A Net
// carries their messages, in order, on flush().
import { createShared, getValue, mergeSnapshot, setLocal, snapshot } from 'layersharedsession/shared.js';

/** The messages between sessions, delivered in order on flush(). */
export class Net {
  constructor() {
    this.queue = [];
  }

  send(from, to, kind, data) {
    this.queue.push({ from, to, kind, data: JSON.parse(JSON.stringify(data)) });
  }

  flush() {
    while (this.queue.length) {
      const m = this.queue.shift();
      m.to.receive(m.from, m.kind, m.data);
    }
  }

  /** Two sessions find each other: each says who it is (join), then sends what it shares. */
  connect(a, b) {
    a.meet(b);
    b.meet(a);
  }

  part(a, b) {
    a.lose(b);
    b.lose(a);
  }
}

/** A session as layersharedsession's session.js has it, what it shares by its shared.js. */
export class FakeSession {
  constructor(net, memberId, name, page = 'instruments', color = '#336699') {
    this.net = net;
    this.self = { selfId: `peer-${memberId}`, memberId, name, color, page };
    this.peers = new Map();
    this.shared = createShared();
    this.fns = new Map();
    this.channels = new Map();
    /** The keys it wrote, in order. */
    this.writes = [];
  }

  on(type, fn) {
    if (!this.fns.has(type)) this.fns.set(type, new Set());
    this.fns.get(type).add(fn);
    return () => this.fns.get(type).delete(fn);
  }

  emit(type, detail) {
    for (const fn of [...(this.fns.get(type) ?? [])]) fn(detail);
  }

  get(key, fallback) {
    return getValue(this.shared, key, fallback);
  }

  set(key, value) {
    const entry = setLocal(this.shared, key, value, this.self.memberId);
    this.writes.push(key);
    this.emit('shared', { key, value, by: this.self.memberId, from: null, initial: false });
    for (const p of this.peers.values()) this.net.send(this, p.session, 'state', { k: 'write', e: { [key]: entry } });
  }

  channel(name) {
    if (!this.channels.has(name)) {
      const fns = new Set();
      this.channels.set(name, {
        fns,
        send: (data, peerId) => {
          for (const p of this.peers.values()) if (!peerId || p.peerId === peerId) this.net.send(this, p.session, `x:${name}`, data);
          return Promise.resolve();
        },
        on: (fn) => {
          fns.add(fn);
          return () => fns.delete(fn);
        },
      });
    }
    return this.channels.get(name);
  }

  meet(other) {
    const p = { peerId: other.self.selfId, memberId: other.self.memberId, name: other.self.name, color: other.self.color, page: other.self.page, session: other };
    this.peers.set(p.peerId, p);
    this.emit('join', p);
    if (this.shared.entries.size) this.net.send(this, other, 'state', { k: 'snapshot', e: snapshot(this.shared) });
  }

  lose(other) {
    const p = this.peers.get(other.self.selfId);
    if (!p) return;
    this.peers.delete(p.peerId);
    this.emit('leave', p);
  }

  /** This visitor goes to another page: the others see them move (update). */
  move(page) {
    this.self.page = page;
    for (const p of this.peers.values()) {
      const me = p.session.peers.get(this.self.selfId);
      if (!me) continue;
      me.page = page;
      p.session.emit('update', me);
    }
  }

  receive(from, kind, data) {
    const p = this.peers.get(from.self.selfId);
    if (!p) return;
    if (kind === 'state') {
      const initial = data.k === 'snapshot';
      for (const key of mergeSnapshot(this.shared, data.e)) {
        const e = this.shared.entries.get(key);
        this.emit('shared', { key, value: e.value, by: e.by, from: p, initial });
      }
    } else for (const fn of this.channels.get(kind.slice(2))?.fns ?? []) fn(data, p);
  }
}
