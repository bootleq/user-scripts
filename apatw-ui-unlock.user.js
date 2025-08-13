// ==UserScript==
// @name         APATW 解除滑鼠限制
// @description  解除 www.apatw.org（中華民國保護動物協會）網站的滑鼠選取和右鍵選單限制
// @version      1.0.0
// @license      MIT
// @author       bootleq
// @namespace    bootleq.com
// @homepageURL  https://github.com/bootleq/user-scripts
//
// @match        https://www.apatw.org/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

'use strict';

const $body = document.body;

function init() {
  resetStyles();
  stopEventPropagation();
}

function resetStyles() {
  const prefixes = ['webkit', 'khtml', 'moz', ''];
  const cssProp = 'user-select';
  const el = $body;

  if (el) {
    const computedStyle = window.getComputedStyle(el);

    for (let k = prefixes.length - 1; k >= 0; k--) {
      const prefix = prefixes[k];
      const style = (prefix ? `-${prefix}-` : '') + cssProp;
      if (computedStyle[style] === 'none') {
        el.style[style] = 'auto';
      }
    }
  }
}

function stopEventPropagation() {
  const event = 'contextmenu';
  document.addEventListener(event, function(e) {
    e.stopPropagation();
    e.stopImmediatePropagation();
  }, true);
}

init();
