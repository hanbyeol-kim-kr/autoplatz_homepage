/* 아우토플라츠 홈페이지 — 페이지 템플릿을 그리는 작은 실행기.
   각 페이지의 <template id="tpl"> 안 마크업에 {{값}}, <sc-for>, <sc-if> 를 채워 #app 에 그립니다. */
(function () {
  'use strict';

  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) {
      if (typeof patch === 'function') patch = patch(this.state);
      Object.assign(this.state, patch || {});
      DC.render();
    }
  }
  window.DCLogic = DCLogic;

  const HOLE = /\{\{([\s\S]*?)\}\}/g;
  const EXACT = /^\s*\{\{([\s\S]*?)\}\}\s*$/;

  function lookup(expr, scopes) {
    expr = expr.trim();
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);
    if (/^'[^']*'$/.test(expr) || /^"[^"]*"$/.test(expr)) return expr.slice(1, -1);
    const parts = expr.split('.');
    for (let i = scopes.length - 1; i >= 0; i--) {
      const sc = scopes[i];
      if (sc != null && typeof sc === 'object' && parts[0] in sc) {
        let v = sc[parts[0]];
        for (let j = 1; j < parts.length; j++) {
          if (v == null) return undefined;
          v = v[parts[j]];
        }
        return v;
      }
    }
    return undefined;
  }

  function interp(str, scopes) {
    return str.replace(HOLE, (_, e) => {
      const v = lookup(e, scopes);
      return v == null || v === false ? '' : String(v);
    });
  }

  function bind(el, ev) {
    el.__dcB = el.__dcB || {};
    if (el.__dcB[ev]) return;
    el.__dcB[ev] = true;
    el.addEventListener(ev, (e) => {
      const h = el.__dcH && el.__dcH[ev];
      if (typeof h === 'function') h(e);
    });
  }

  function proc(node, scopes, out) {
    if (node.nodeType === 3) {
      out.appendChild(document.createTextNode(interp(node.data, scopes)));
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.localName;
    if (tag === 'sc-for') {
      const m = EXACT.exec(node.getAttribute('list') || '');
      const list = m ? lookup(m[1], scopes) : null;
      const as = node.getAttribute('as') || 'item';
      if (Array.isArray(list)) {
        list.forEach((item, index) => {
          const sc = scopes.concat([{ [as]: item, index: index }]);
          node.childNodes.forEach((c) => proc(c, sc, out));
        });
      }
      return;
    }
    if (tag === 'sc-if') {
      const m = EXACT.exec(node.getAttribute('value') || '');
      const v = m ? lookup(m[1], scopes) : false;
      if (v) node.childNodes.forEach((c) => proc(c, scopes, out));
      return;
    }
    const el = node.namespaceURI && node.namespaceURI !== 'http://www.w3.org/1999/xhtml'
      ? document.createElementNS(node.namespaceURI, node.tagName)
      : document.createElement(tag);
    for (const at of Array.from(node.attributes)) {
      const name = at.name;
      if (name.indexOf('hint-') === 0) continue;
      const m = EXACT.exec(at.value);
      if (name.length > 2 && name.indexOf('on') === 0 && m) {
        const fn = lookup(m[1], scopes);
        if (typeof fn === 'function') {
          const ev = name.slice(2).toLowerCase();
          el.__dcH = el.__dcH || {};
          el.__dcH[ev] = fn;
          bind(el, ev);
        }
        continue;
      }
      let val;
      if (m) {
        const v = lookup(m[1], scopes);
        if (v == null || v === false) continue;
        val = v === true ? '' : String(v);
      } else {
        val = at.value.indexOf('{{') >= 0 ? interp(at.value, scopes) : at.value;
      }
      if (at.namespaceURI) el.setAttributeNS(at.namespaceURI, name, val);
      else el.setAttribute(name, val);
    }
    const src = tag === 'template' ? node.content : node;
    src.childNodes.forEach((c) => proc(c, scopes, el));
    out.appendChild(el);
  }

  function morph(a, b) {
    const ac = Array.from(a.childNodes);
    const bc = Array.from(b.childNodes);
    for (let i = 0; i < bc.length; i++) {
      const x = ac[i];
      const y = bc[i];
      if (!x) { a.appendChild(y); continue; }
      if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) { a.replaceChild(y, x); continue; }
      if (x.nodeType === 3) { if (x.data !== y.data) x.data = y.data; continue; }
      if (x.nodeType !== 1) continue;
      for (const at of Array.from(x.attributes)) if (!y.hasAttribute(at.name)) x.removeAttribute(at.name);
      for (const at of Array.from(y.attributes)) if (x.getAttribute(at.name) !== at.value) x.setAttribute(at.name, at.value);
      x.__dcH = y.__dcH;
      if (y.__dcH) Object.keys(y.__dcH).forEach((ev) => bind(x, ev));
      morph(x, y);
    }
    for (let i = bc.length; i < ac.length; i++) a.removeChild(ac[i]);
  }

  const DC = {
    mount(Component) {
      this.tpl = document.getElementById('tpl').content;
      this.app = document.getElementById('app');
      this.comp = new Component({});
      this.render();
      if (typeof this.comp.componentDidMount === 'function') this.comp.componentDidMount();
    },
    render() {
      if (!this.comp) return;
      const vals = this.comp.renderVals() || {};
      const frag = document.createElement('div');
      this.tpl.childNodes.forEach((c) => proc(c, [vals], frag));
      morph(this.app, frag);
    }
  };
  window.DC = DC;
})();
