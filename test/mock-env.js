const fs = require('fs');
const path = require('path');

// 1. Helper to match CSS selectors
function matches(node, sel) {
  if (!node || node.nodeType === 3) return false; // Text nodes don't match selectors
  const tag = node.tagName.toLowerCase();
  
  let isNotDisabled = false;
  if (sel.endsWith(':not([disabled])')) {
    isNotDisabled = true;
    sel = sel.slice(0, -16);
  }
  
  let matched = false;
  if (sel === 'textarea') matched = tag === 'textarea';
  else if (sel === 'button') matched = tag === 'button';
  else if (sel === 'ul') matched = tag === 'ul';
  else if (sel === 'p') matched = tag === 'p';
  else if (sel === 'div') matched = tag === 'div';
  else if (sel === 'span') matched = tag === 'span';
  else if (sel === 'img') matched = tag === 'img';
  else if (sel === 'input') matched = tag === 'input';
  else if (sel === 'li') matched = tag === 'li';
  else if (sel.startsWith('#')) matched = node.id === sel.slice(1);
  else if (sel.startsWith('.')) {
    const cls = sel.slice(1);
    matched = node.className && node.className.split(/\s+/).includes(cls);
  }
  else if (sel.startsWith('[data-role=')) {
    const val = sel.match(/data-role="([^"]+)"/)?.[1] || sel.match(/data-role='([^']+)'/)?.[1];
    matched = node.dataset && node.dataset.role === val;
  }
  else if (sel.startsWith('[data-tooltip*=')) {
    const val = sel.match(/data-tooltip\*="([^"]+)"/)?.[1] || sel.match(/data-tooltip\*='([^']+)'/)?.[1];
    matched = node.dataset && node.dataset.tooltip && node.dataset.tooltip.includes(val);
  }
  else if (sel.startsWith('[data-tooltip=')) {
    const val = sel.match(/data-tooltip="([^"]+)"/)?.[1] || sel.match(/data-tooltip='([^']+)'/)?.[1];
    matched = node.dataset && node.dataset.tooltip === val;
  }
  
  if (isNotDisabled && matched && node.disabled) {
    return false;
  }
  return matched;
}

// 2. Class representing HTML DOM Nodes
class MockNode {
  constructor(nodeType, tagName) {
    this.nodeType = nodeType;
    this.tagName = tagName ? tagName.toUpperCase() : null;
    this.childNodes = [];
    this.parentNode = null;
    this.listeners = {};
    this.id = '';
    this.className = '';
    this.style = {};
    this.dataset = {};
    this.attributes = {};
    this._value = '';
    this._disabled = false;
    this._src = '';
    this._alt = '';
  }

  get classList() {
    const self = this;
    return {
      add(cls) {
        const classes = self.className ? self.className.split(/\s+/) : [];
        if (!classes.includes(cls)) {
          classes.push(cls);
          self.className = classes.join(' ');
          self.setAttribute('class', self.className);
        }
      },
      remove(cls) {
        const classes = self.className ? self.className.split(/\s+/) : [];
        const index = classes.indexOf(cls);
        if (index !== -1) {
          classes.splice(index, 1);
          self.className = classes.join(' ');
          self.setAttribute('class', self.className);
        }
      },
      contains(cls) {
        const classes = self.className ? self.className.split(/\s+/) : [];
        return classes.includes(cls);
      }
    };
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'id') this.id = String(value);
    if (name === 'class') this.className = String(value);
    if (name.startsWith('data-')) {
      const dataKey = name.slice(5).replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      this.dataset[dataKey] = String(value);
    }
  }

  getAttribute(name) {
    if (name === 'id') return this.id;
    if (name === 'class') return this.className;
    if (name.startsWith('data-')) {
      const dataKey = name.slice(5).replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      return this.dataset[dataKey];
    }
    return this.attributes[name];
  }

  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'id') this.id = '';
    if (name === 'class') this.className = '';
    if (name.startsWith('data-')) {
      const dataKey = name.slice(5).replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      delete this.dataset[dataKey];
    }
  }

  appendChild(child) {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.childNodes.push(child);
    this._triggerMutation({ addedNodes: [child] });
    return child;
  }

  append(...children) {
    for (const child of children) {
      if (typeof child === 'string') {
        const txt = new MockNode(3, null);
        txt.textContent = child;
        this.appendChild(txt);
      } else {
        this.appendChild(child);
      }
    }
  }

  prepend(child) {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.childNodes.unshift(child);
    this._triggerMutation({ addedNodes: [child] });
  }

  before(node) {
    if (!this.parentNode) return;
    const idx = this.parentNode.childNodes.indexOf(this);
    if (idx !== -1) {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
      node.parentNode = this.parentNode;
      this.parentNode.childNodes.splice(idx, 0, node);
      this.parentNode._triggerMutation({ addedNodes: [node] });
    }
  }

  after(node) {
    if (!this.parentNode) return;
    const idx = this.parentNode.childNodes.indexOf(this);
    if (idx !== -1) {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
      node.parentNode = this.parentNode;
      this.parentNode.childNodes.splice(idx + 1, 0, node);
      this.parentNode._triggerMutation({ addedNodes: [node] });
    }
  }

  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
      this._triggerMutation({ removedNodes: [child] });
      return child;
    }
    throw new Error('Not a child node');
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  replaceChildren(...children) {
    const removed = [...this.childNodes];
    for (const child of removed) {
      child.parentNode = null;
    }
    this.childNodes = [];
    this._triggerMutation({ removedNodes: removed });
    this.append(...children);
  }

  get textContent() {
    if (this.nodeType === 3) return this._textContent || '';
    return this.childNodes.map(c => c.textContent).join('');
  }

  set textContent(val) {
    if (this.nodeType === 3) {
      this._textContent = String(val);
    } else {
      this.replaceChildren(val);
    }
  }

  get value() {
    return this._value || '';
  }
  set value(val) {
    this._value = String(val);
  }

  get disabled() {
    return !!this._disabled;
  }
  set disabled(val) {
    this._disabled = !!val;
    if (this._disabled) {
      this.setAttribute('disabled', 'disabled');
    } else {
      this.removeAttribute('disabled');
    }
  }

  get src() {
    return this._src || '';
  }
  set src(val) {
    this._src = String(val);
    this.setAttribute('src', this._src);
    if (this.tagName === 'IMG' && typeof this.simulateLoad === 'function') {
      setTimeout(() => this.simulateLoad(), 0);
    }
  }

  get alt() {
    return this._alt || '';
  }
  set alt(val) {
    this._alt = String(val);
    this.setAttribute('alt', this._alt);
  }

  get loading() {
    return this._loading || '';
  }
  set loading(val) {
    this._loading = String(val);
    this.setAttribute('loading', this._loading);
  }

  get firstElementChild() {
    return this.childNodes.find(c => c.nodeType === 1) || null;
  }

  addEventListener(type, listener, options) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push({ listener, options });
  }

  removeEventListener(type, listener) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(l => l.listener !== listener);
  }

  dispatchEvent(event) {
    event.target = this;
    let current = this;
    while (current) {
      const typeListeners = current.listeners[event.type];
      if (typeListeners) {
        for (const { listener } of typeListeners) {
          try {
            listener.call(current, event);
          } catch (e) {
            console.error('Error in event listener:', e);
          }
          if (event._stoppedImmediatePropagation) break;
        }
      }
      if (event.bubbles && !event._stoppedPropagation) {
        current = current.parentNode;
      } else {
        break;
      }
    }
    return !event.defaultPrevented;
  }

  click() {
    const event = new Event('click', { bubbles: true, cancelable: true });
    this.dispatchEvent(event);
  }

  querySelector(selector) {
    const list = [];
    this._findNodes(selector, list, true);
    return list[0] || null;
  }

  querySelectorAll(selector) {
    const list = [];
    this._findNodes(selector, list, false);
    return list;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (matches(current, selector)) return current;
      current = current.parentNode;
    }
    return null;
  }

  contains(otherNode) {
    let current = otherNode;
    while (current) {
      if (current === this) return true;
      current = current.parentNode;
    }
    return false;
  }

  getBoundingClientRect() {
    return {
      left: this._rectLeft || 100,
      top: this._rectTop || 200,
      right: (this._rectLeft || 100) + (this._rectWidth || 20),
      bottom: (this._rectTop || 200) + (this._rectHeight || 20),
      width: this._rectWidth || 20,
      height: this._rectHeight || 20
    };
  }

  _findNodes(selector, list, firstOnly) {
    for (const child of this.childNodes) {
      if (matches(child, selector)) {
        list.push(child);
        if (firstOnly) return;
      }
      child._findNodes(selector, list, firstOnly);
      if (firstOnly && list.length > 0) return;
    }
  }

  _triggerMutation(record) {
    MutationObserver._notify({
      target: this,
      type: 'childList',
      addedNodes: record.addedNodes || [],
      removedNodes: record.removedNodes || []
    });
  }

  focus() {
    document.activeElement = this;
    const focusEvent = new Event('focus', { bubbles: false });
    this.dispatchEvent(focusEvent);
  }

  select() {
    this.focus();
    const selectEvent = new Event('select', { bubbles: false });
    this.dispatchEvent(selectEvent);
  }
}

// 3. Mock Event class
class Event {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = !!options.bubbles;
    this.cancelable = !!options.cancelable;
    this.target = null;
    this.defaultPrevented = false;
    this._stoppedPropagation = false;
    this._stoppedImmediatePropagation = false;
  }
  preventDefault() {
    if (this.cancelable) this.defaultPrevented = true;
  }
  stopPropagation() {
    this._stoppedPropagation = true;
  }
  stopImmediatePropagation() {
    this._stoppedImmediatePropagation = true;
    this._stoppedPropagation = true;
  }
}

// 4. Mock MutationObserver class
class MutationObserver {
  static observers = [];

  constructor(callback) {
    this.callback = callback;
    this.target = null;
    this.options = null;
    MutationObserver.observers.push(this);
  }

  observe(target, options) {
    this.target = target;
    this.options = options;
  }

  disconnect() {
    MutationObserver.observers = MutationObserver.observers.filter(o => o !== this);
  }

  static _notify(mutationRecord) {
    for (const obs of MutationObserver.observers) {
      if (obs.target && obs.callback) {
        const isMatch = obs.options.subtree 
          ? obs.target.contains(mutationRecord.target)
          : obs.target === mutationRecord.target;
          
        if (isMatch) {
          setTimeout(() => {
            obs.callback([mutationRecord]);
          }, 0);
        }
      }
    }
  }
}

// 5. Mock IntersectionObserver class
class IntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.observedElements = [];
  }
  observe(element) {
    this.observedElements.push(element);
    setTimeout(() => {
      if (this.callback) {
        this.callback([{
          isIntersecting: true,
          target: element
        }], this);
      }
    }, 0);
  }
  unobserve(element) {
    this.observedElements = this.observedElements.filter((item) => item !== element);
  }
  disconnect() {
    this.observedElements = [];
  }
}

// 6. Global DOM setup
const documentMock = new MockNode(1, 'document');
documentMock.body = new MockNode(1, 'body');
documentMock.appendChild(documentMock.body);
documentMock.readyState = 'complete';

documentMock.createElement = function(tagName) {
  const node = new MockNode(1, tagName);
  if (tagName.toLowerCase() === 'img') {
    node.simulateLoad = function() {
      const event = new Event('load');
      node.dispatchEvent(event);
    };
    node.simulateError = function() {
      const event = new Event('error');
      node.dispatchEvent(event);
    };
  }
  return node;
};

documentMock.getElementById = function(id) {
  return this.querySelector(`#${id}`);
};

const windowListeners = {};
const windowMock = {
  innerWidth: 1024,
  innerHeight: 768,
  location: {
    href: 'https://www.chatwork.com/#!rid232079630',
    hash: '#!rid232079630'
  },
  addEventListener(type, listener) {
    if (!windowListeners[type]) windowListeners[type] = [];
    windowListeners[type].push(listener);
  },
  removeEventListener(type, listener) {
    if (!windowListeners[type]) return;
    windowListeners[type] = windowListeners[type].filter(l => l !== listener);
  },
  dispatchEvent(event) {
    if (windowListeners[event.type]) {
      for (const listener of windowListeners[event.type]) {
        listener(event);
      }
    }
  },
  requestAnimationFrame(callback) {
    return setTimeout(callback, 16);
  }
};

// 7. Mock storage setup
const storageMap = new Map();
const chromeMock = {
  storage: {
    local: {
      get(keys, callback) {
        let result = {};
        if (typeof keys === 'string') {
          result[keys] = storageMap.get(keys);
        } else if (Array.isArray(keys)) {
          for (const key of keys) {
            result[key] = storageMap.get(key);
          }
        } else if (typeof keys === 'object' && keys !== null) {
          for (const key of Object.keys(keys)) {
            result[key] = storageMap.has(key) ? storageMap.get(key) : keys[key];
          }
        } else {
          for (const [key, value] of storageMap.entries()) {
            result[key] = value;
          }
        }
        if (callback) callback(result);
        return Promise.resolve(result);
      },
      set(data, callback) {
        for (const [key, value] of Object.entries(data)) {
          storageMap.set(key, JSON.parse(JSON.stringify(value)));
        }
        if (callback) callback();
        return Promise.resolve();
      },
      clear(callback) {
        storageMap.clear();
        if (callback) callback();
        return Promise.resolve();
      },
      remove(keys, callback) {
        if (typeof keys === 'string') {
          storageMap.delete(keys);
        } else if (Array.isArray(keys)) {
          for (const key of keys) {
            storageMap.delete(key);
          }
        }
        if (callback) callback();
        return Promise.resolve();
      }
    }
  },
  runtime: {
    getURL(path) {
      return `chrome-extension://mock-id/${path}`;
    },
    onMessage: {
      listeners: [],
      addListener(listener) {
        this.listeners.push(listener);
      },
      removeListener(listener) {
        this.listeners = this.listeners.filter(l => l !== listener);
      },
      _trigger(message, sender, sendResponse) {
        for (const listener of this.listeners) {
          listener(message, sender, sendResponse);
        }
      }
    },
    sendMessage(message, callback) {
      const responseCallback = callback || (() => {});
      chromeMock.runtime.onMessage._trigger(message, {}, responseCallback);
    }
  },
  webRequest: {
    onBeforeRequest: {
      listeners: [],
      addListener(listener, filter, extraInfoSpec) {
        this.listeners.push({ listener, filter, extraInfoSpec });
      },
      removeListener(listener) {
        this.listeners = this.listeners.filter(entry => entry.listener !== listener);
      },
      _trigger(details) {
        for (const { listener } of this.listeners) {
          listener(details);
        }
      }
    }
  },
  tabs: {
    query(options, callback) {
      const mockTabs = [{ id: 1, active: true, currentWindow: true }];
      if (callback) callback(mockTabs);
      return Promise.resolve(mockTabs);
    },
    sendMessage(tabId, message, callback) {
      return new Promise((resolve) => {
        let responded = false;
        const sendResponse = (res) => {
          if (responded) return;
          responded = true;
          if (callback) callback(res);
          resolve(res);
        };
        chromeMock.runtime.onMessage._trigger(message, {}, sendResponse);
        setTimeout(() => {
          if (!responded) {
            sendResponse(undefined);
          }
        }, 0);
      });
    }
  }
};

const localStorageMap = new Map();
const localStorageMock = {
  getItem(key) {
    return localStorageMap.get(key) || null;
  },
  setItem(key, value) {
    localStorageMap.set(key, String(value));
  },
  removeItem(key) {
    localStorageMap.delete(key);
  },
  clear() {
    localStorageMap.clear();
  }
};

// 8. Mock Fetch using Node fs
const fetchMock = function(url) {
  const extensionPrefix = 'chrome-extension://mock-id/';
  let relativePath = url;
  if (url.startsWith(extensionPrefix)) {
    relativePath = url.slice(extensionPrefix.length);
  }
  
  const absolutePath = path.resolve(__dirname, '../', relativePath);
  try {
    const data = fs.readFileSync(absolutePath, 'utf8');
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve(JSON.parse(data))
      });
  } catch (err) {
    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.reject(err)
    });
  }
};

// 9. Reset function to rebuild Chatwork DOM
function resetDOM() {
  documentMock.body.replaceChildren();
  documentMock.body.dataset = {};
  
  // Clear event listeners on document and window to prevent leaks
  documentMock.listeners = {};
  for (const key of Object.keys(windowListeners)) {
    delete windowListeners[key];
  }
  
  const sendArea = documentMock.createElement('div');
  sendArea.id = '_chatSendArea';

  const toolbarList = documentMock.createElement('ul');

  const emojiButton = documentMock.createElement('li');
  emojiButton.setAttribute('data-tooltip', 'Emoji');
  const emojiBtnInside = documentMock.createElement('button');
  emojiBtnInside.className = 'chatInput__emojiButton';
  emojiButton.appendChild(emojiBtnInside);

  toolbarList.appendChild(emojiButton);
  sendArea.appendChild(toolbarList);

  const chatText = documentMock.createElement('textarea');
  chatText.id = '_chatText';
  sendArea.appendChild(chatText);

  documentMock.body.appendChild(sendArea);
  
  global.activeTab = "all";
  global.favorites = new Set();
  global.recents = [];
  global.stickerSearchQuery = "";
  if (global.brokenStickerPreviewIds) {
    global.brokenStickerPreviewIds.clear();
  }
  global.currentStickers = [];
  global.activeStickerImageLoads = 0;
  global.maxObservedStickerImageLoads = 0;
}

// 10. Simulate keydowns
function simulateKeydown(key, options = {}) {
  const event = new Event('keydown', { bubbles: true, cancelable: true });
  event.key = key;
  event.ctrlKey = !!options.ctrlKey;
  event.shiftKey = !!options.shiftKey;
  event.altKey = !!options.altKey;
  event.metaKey = !!options.metaKey;
  
  const activeElement = documentMock.activeElement || documentMock.body;
  activeElement.dispatchEvent(event);
  
  windowMock.dispatchEvent(event);
}

// Attach mocks to global scope
global.window = windowMock;
global.document = documentMock;
global.chrome = chromeMock;
global.localStorage = localStorageMock;
global.fetch = fetchMock;
global.Event = Event;
global.MutationObserver = MutationObserver;
global.IntersectionObserver = IntersectionObserver;
global.resetDOM = resetDOM;
global.simulateKeydown = simulateKeydown;
global.requestAnimationFrame = windowMock.requestAnimationFrame;
global.cancelAnimationFrame = function(id) { clearTimeout(id); };

// Timer overrides to ignore background setup timers from content.js and run others immediately
global.setTimeout = (callback, delay, ...args) => {
  if (delay === 3000 || delay === 5000) {
    return {
      unref() {},
      ref() {}
    };
  }
  setImmediate(() => callback(...args));
  return {
    unref() {},
    ref() {}
  };
};

global.setInterval = (callback, delay, ...args) => {
  if (delay === 1000) {
    return {
      unref() {},
      ref() {}
    };
  }
  setImmediate(() => callback(...args));
  return {
    unref() {},
    ref() {}
  };
};

module.exports = {
  window: windowMock,
  document: documentMock,
  chrome: chromeMock,
  localStorage: localStorageMock,
  fetch: fetchMock,
  Event,
  MutationObserver,
  IntersectionObserver,
  resetDOM,
  simulateKeydown
};
