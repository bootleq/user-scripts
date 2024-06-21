// ==UserScript==
// @name              Facebook 不要自動重新整理
// @description       抵抗臉書首頁（動態消息）自動重整的行為
// @version           1.0.0
// @license           MIT
// @author            bootleq
// @namespace         bootleq.com
// @homepageURL       https://github.com/bootleq/user-scripts
//
// @match             https://www.facebook.com/*
// @run-at            document-idle
// @grant             none
// @noframes
// ==/UserScript==

const seconds = 1000;
const minutes = 60 * seconds;
const hours = 60 * minutes;

const gFeedStaleTimeout = 48 * hours; // 動態消息過期（隨後會自動重刷）的時間

const gLoadInterval = 10;         // 等待 FB 啟動（以符合預期條件）期間，重試間隔（毫秒）
const gLoadTimeout = 8 * seconds; // 等待 FB 啟動（以符合預期條件）的最大時間，超過就放棄執行功能
const gMessagePrefix = 'FB-R';    // 使用 console.log 時的固定訊息開頭，R for Refresh

// Although `@grant none` seems enough to access FB window directly,
// on Firefox we can't inject script to "page" due to CSP.
// That's why still need to try wrappedJSObject.
// https://github.com/violentmonkey/violentmonkey/issues/1001
const pageWin = ('wrappedJSObject' in window) ? window.wrappedJSObject : window;
let isHomeVisited = false;

const log = (...args) => {
  console.log(`[${gMessagePrefix}]`, ...args);
};

const waitFor = (condition, interval, timeout) => {
  return new Promise((resolve, reject) => {
    let startTime = Date.now();

    const id = setInterval(() => {
      log('Wait for FB init...');

      if (condition()) {
        clearInterval(id);
        resolve();
      }

      const elapsedTime = Date.now() - startTime;

      if (elapsedTime >= timeout) {
        clearInterval(id);
        reject();
      }
    }, interval);
  });
};

// Detect the global function really named 'require'
const getRequireFunction = () => (typeof pageWin.require === 'function');

const delayFeedStale = () => {
  try {
    const m = pageWin.require('CometFeedStalenessConstants');

    if (
      typeof m !== 'object' ||
      typeof m.FEED_STALE_TIMEOUT !== 'number' ||
      typeof m.BADGE_STALE_TIMEOUT !== 'number'
    ) {
      throw new Error('Unexpected shape of CometFeedStalenessConstants');
    }

    const oldValue = JSON.stringify(m);
    m.FEED_STALE_TIMEOUT = gFeedStaleTimeout;
    m.BADGE_STALE_TIMEOUT = gFeedStaleTimeout;
    log(`CometFeedStalenessConstants updated:\n  ${oldValue} =>\n  ${JSON.stringify(m)}.`);
  } catch (error) {
    showFailureMsg();
    log('delayFeedStale failed:', error);
  }
};

const onNavigate = () => {
  if (isHomeVisited) {
    return;
  }

  if (window.location.pathname === '/') {
    isHomeVisited = true;

    waitFor(getRequireFunction, gLoadInterval, gLoadTimeout).then(delayFeedStale);

    if ('navitation' in pageWin) {
      pageWin.removeEventListener("navigatesuccess", onNavigate);
    } else {
      // Won't fix.
      // history `pushState` and `replaceState` hijack are not reversed
    }
  }
};

const watchNavigation = () => {
  if ('navitation' in pageWin) {
    pageWin.addEventListener("navigatesuccess", onNavigate);
  } else {
    const oldPush = pageWin.history.pushState;
    const oldReplace = pageWin.history.replaceState;

    pageWin.history.pushState = function (...args) {
      const result = oldPush.apply(this, args);
      onNavigate();
      return result;
    };
    pageWin.history.replaceState = function (...args) {
      const result = oldReplace.apply(this, args);
      onNavigate();
      return result;
    };
  }
};

const showFailureMsg = () => {
  const $div = document.createElement('div');
  const style = {
    position: 'fixed', bottom: '1%', left: 0, padding: '0 12px 10px', margin: '6px',
    backgroundColor: 'rgba(245,222,179, .95)', cursor: 'pointer',
    borderRadius: '8px', boxShadow: '-3px -3px 6px gold, 3px 3px 6px red'
  };
  $div.innerHTML = `
    <p style='white-space: preserve-breaks; margin: 0'>
      UserScript「Facebook 不要自動重新整理」
      執行失敗，可能已經失效了。
    </p>
    <p>點擊以關閉訊息。</p>
  `;
  Object.assign($div.style, style);
  document.body.appendChild($div);
  $div.addEventListener('click', () => $div.remove());
};


onNavigate();

if (!isHomeVisited) {
  // Though auto-refresh only occur on News Feed,
  // watch navitation for case that enter "/" from other paths like "/help".
  watchNavigation();
}
