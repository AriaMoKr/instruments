// Just enough of a page for overlay.js in Node: elements with attributes, classes, children, text
// and listeners, the two overlay roots, ResizeObserver, and window's listeners. installDom() puts
// it on globalThis; the returned function takes it off again.

class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.listeners = {};
    this._text = '';
    this._classes = new Set();
    this.style = {
      cssText: '',
      setProperty: (k, v) => { this.style[k] = String(v); },
      getPropertyValue: (k) => (typeof this.style[k] === 'string' ? this.style[k] : ''),
      removeProperty: (k) => {
        const v = this.style.getPropertyValue(k);
        delete this.style[k];
        return v;
      },
    };
    this.classList = {
      add: (c) => this._classes.add(c),
      remove: (c) => this._classes.delete(c),
      contains: (c) => this._classes.has(c),
      toggle: (c, on = !this._classes.has(c)) => (on ? this._classes.add(c) : this._classes.delete(c), on),
    };
    this.checked = false;
    this.offsetHeight = 42;
  }

  set className(v) {
    this._classes = new Set(String(v).split(/\s+/).filter(Boolean));
  }

  get className() {
    return [...this._classes].join(' ');
  }

  setAttribute(name, value) {
    if (name === 'hidden') this.hidden = true;
    else this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    if (name === 'hidden') this.hidden = false;
    else this.attributes.delete(name);
  }

  getAttribute(name) {
    return name === 'hidden' ? (this.hidden ? '' : null) : this.attributes.get(name) ?? null;
  }

  append(...nodes) {
    for (const n of nodes) {
      if (typeof n === 'string') this._text += n;
      else {
        n.parentNode = this;
        this.children.push(n);
      }
    }
  }

  replaceChildren(...nodes) {
    this._text = '';
    this.children = [];
    this.append(...nodes);
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((c) => c !== this);
    this.parentNode = null;
  }

  get textContent() {
    return this._text + this.children.map((c) => c.textContent).join('');
  }

  set textContent(v) {
    this._text = String(v);
    this.children = [];
  }

  addEventListener(type, fn) {
    (this.listeners[type] ??= []).push(fn);
  }

  /** Fires `type` at it: a click, or a change (an input's), with what else the event has (`props`: a press's button, its timeStamp, its target). */
  fire(type, props = {}) {
    for (const fn of this.listeners[type] ?? []) fn({ type, target: this, preventDefault() {}, stopPropagation() {}, ...props });
  }

  /** Focused: the document's activeElement. */
  focus() {
    globalThis.document.activeElement = this;
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }

  /** Every element below it (depth first) that `pred` accepts. */
  findAll(pred) {
    const out = [];
    const walk = (n) => {
      for (const c of n.children) {
        if (pred(c)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
}

/** Puts the page on globalThis: document (with #overlay and #view-overlay), ResizeObserver, window's listeners. */
export function installDom() {
  const roots = { overlay: new Element('div'), 'view-overlay': new Element('div') };
  const saved = {};
  const set = (k, v) => {
    saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
    Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  };
  set('document', {
    createElement: (tag) => new Element(tag),
    getElementById: (id) => roots[id] ?? null,
    documentElement: new Element('html'),
    activeElement: null,
  });
  set('ResizeObserver', class { constructor(fn) { this.fn = fn; } observe() {} });
  set('addEventListener', () => {});
  set('innerHeight', 800);
  return Object.assign(() => {
    for (const [k, d] of Object.entries(saved)) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  }, { roots });
}
