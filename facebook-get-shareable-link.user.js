// ==UserScript==
// @name          Facebook 取得帶標題連結
// @description   在臉書頁面顯示按鈕，取得帶有完整標題的 <a> 連結以便分享
// @version       1.0.0
// @license       MIT
// @author        bootleq
// @namespace     bootleq.com
// @homepageURL    https://github.com/bootleq/user-scripts
//
// @match         https://www.facebook.com/*
// @run-at        document-idle
//
// @grant         GM_xmlhttpRequest
// @grant         GM_addStyle
// @noframes
// ==/UserScript==

const ID_PREFIX = 'FB_SHAREABLE_LINK';
const MENU_ID = `${ID_PREFIX}_BTN`;
const DIALOG_ID = `${ID_PREFIX}_DIALOG`;
const ERROR_ID  = `${ID_PREFIX}_ERROR`;
const BG_STYLE = 'linear-gradient( 135deg, #5a1f2b 0%, #7a2d5c 40%, #a12a3a 70%, #d14a6a 100%)';
const MENU_ICON = '🍖';
const MENU_TEXT = '帶標題的連結';
const LOG_PREFIX = 'FB-GSL';    // 使用 console.log 時的固定訊息開頭，GSL for Get Share Link
const SELECTORS = {
  modalDialogDetect: ':is(.__fb-light-mode, .__fb-dark-mode) [role="dialog"]:not([aria-label^="載入中"]) [role="button"][aria-label="關閉"]',
  insertToBanner: '[role="banner"] [role="navigation"][aria-label="帳號控制項和設定"]',
  insertToModal: ':is(.__fb-light-mode, .__fb-dark-mode)',
  videoPauseButton: 'div[role="main"] [role="button"][aria-label="暫停"]',
};
const THROTTLE_DELAY = 250;

let $menu;
let menuAttachTo = 'banner'; // 'banner' | 'modal'

const menuHTML = function () {
  return `
      <span>${MENU_ICON}</span>
      <div>
        <span data-text>${MENU_TEXT}</span>
        <button data-action='close'">✖</button>
      </div>
      <div class='dropdown'>
        <div class='desc'>拖曳連結進來，或</div>
        <button data-action='current-post'>
          偵測目前內容
        </button>
      </div>
    `;
};

GM_addStyle(`
  #${MENU_ID} {
    display: flex;
    flex-direction: row;
    align-items: center;
    top: 10em;
    margin-right: 9px;
    padding: 6px;
    border-radius: 16px;
    border: 1px solid darkred;
    box-shadow: 0 8px 40px rgba(0,0,0,.5);
    background: ${BG_STYLE};
    color: white;
    cursor: not-allowed;
    opacity: 0.8;
    anchor-name: --user-${ID_PREFIX}-button-anchor;
  }
  #${MENU_ID}[data-attach-to="modal"] {
    position: fixed;
    right: 0;
  }
  #${MENU_ID}.dragover {
    outline: 2px solid gold;
    box-shadow: 0 0 3px 3px gold;
  }
  #${MENU_ID} > div {
    display: flex;
    flex-direction: row;
    align-items: center;
    overflow: hidden;
    max-width: 0;
    white-space: nowrap;
    transition: max-width 500ms ease, margin-right 10s ease-in-out;
    margin-right: 0;
  }
  #${MENU_ID}:hover > div,
  #${MENU_ID}.waiting > div,
  #${MENU_ID}.dragover > div {
    max-width: 600px;
  }
  #${MENU_ID}:active > div {
    margin-right: clamp(10em, 42vw, 64em);
  }
  #${MENU_ID}:not([data-disabled="true"]) {
    cursor: pointer;
    opacity: 1;
  }
  #${MENU_ID} button[data-action='close'] {
    background: none;
    border: none;
    padding: 0 2px 0 8px;
    font-size: smaller;
    transform-origin: right;
    cursor: pointer;
  }
  #${MENU_ID} button[data-action='close']:hover {
    transform: scale(1.4);
  }
  #${MENU_ID} .dropdown {
    font-size: smaller;
    display: none;
    flex-direction: column;
    gap: 5px;
    position: fixed;
    top: anchor(bottom);
    justify-self: anchor-center;
    margin-top: 2px;
    position-anchor: --user-${ID_PREFIX}-button-anchor;
  }
  #${MENU_ID}.waiting .dropdown {
    display: flex;
  }
  #${MENU_ID} .desc {
  }
  #${MENU_ID} button[data-action='current-post'] {
    font-size: inherit;
    cursor: pointer;
  }
  #${MENU_ID}.waiting button[data-action='current-post'] {
    display: block;
  }

  #${DIALOG_ID} {
    border: none;
    border-radius: 12px;
    padding: 1.025em 1.44em;
    width: min(560px, 90vw);
    box-shadow: 0 8px 40px rgba(0,0,0,.3);
    background: ${BG_STYLE};
    color: white;
    outline: 4px solid rgba(200, 200, 200, 0.85);
  }
  #${DIALOG_ID}::backdrop {
    background: rgba(0,0,0,.55);
  }
  #${DIALOG_ID} > div {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  #${DIALOG_ID} h2 {
    color: white;
    margin-bottom: 6px;
  }
  #${DIALOG_ID} ul {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  #${DIALOG_ID} li {
    display: flex;
    flex-direction: row;
    gap: 8px;
  }
  #${DIALOG_ID} li > strong {
    min-width: 2em;
    font-weight: normal;
    word-break: keep-all;
  }
  #${DIALOG_ID} li > div {
    flex-grow: 1;
  }
  #${DIALOG_ID} textarea {
    font-size: smaller;
    width: 98%;
    rgb(255, 255, 255, 0.85);
  }
  #${DIALOG_ID} [data-preview] {
    background-color: white;
    color: black;
    padding: 2px 4px;
  }
  #${DIALOG_ID} .actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 4px;
  }
  #${DIALOG_ID} .actions button {
    padding: 6px 14px;
    border-radius: 8px;
    border: none;
    background: #1877f2;
    color: #fff;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
  }
  #${DIALOG_ID} .actions button:focus-visible {
    outline: 2px solid gold;
    box-shadow: 0 0 3px 3px gold;
  }

  #${ERROR_ID} {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #ff4444;
    color: #fff;
    padding: 12px 20px;
    borderRadius: 10px;
    fontSize: 14px;
    boxShadow: 0 4px 16px rgba(0,0,0,.2);
  }
`);

function getCanonicalUrl(url) {
  const urlObj = url instanceof URL ? url : new URL(url);
  const { origin, pathname, search } = urlObj;
  const params = new URLSearchParams(search);

  let match;

  // /{user}/posts/{id}
  match = pathname.match(/^\/(?:[^\/]+)\/posts\/(.+)/);
  if (match) {
    return `${origin}${pathname}`;
  }

  // /groups/{group}/posts/{id}
  match = pathname.match(/^\/groups\/(?:[^\/]+)\/posts\/(.+)/);
  if (match) {
    return `${origin}${pathname}`;
  }

  // /groups/{group}/?multi_permalinks={id}
  match = pathname.match(/^\/groups\/(?:[^\/]+)\//);
  if (match && params.has('multi_permalinks')) {
    const postId = params.get('multi_permalinks');
    return `${origin}${pathname}posts/${postId}`;
  }

  // /reel/{id}
  match = pathname.match(/^\/reel\/(\d+)/);
  if (match) {
    return `https://www.facebook.com/video.php?v=${match[1]}`;
  }

  // /watch/?v={id}
  if (pathname === '/watch/' && params.has('v')) {
    return `${origin}/video.php?v=${params.get('v')}`;
  }

  // /{user}/videos/{id}/
  match = pathname.match(/^\/(?:[^\/]+)\/videos\/(\d+)/);
  if (match) {
    return `https://www.facebook.com/video.php?v=${match[1]}`;
  }

  return null;
}

function injectButton($target) {
  if (document.getElementById(MENU_ID)) return;

  const $div = document.createElement('div');

  $div.innerHTML = menuHTML();
  $div.id = MENU_ID;
  $div.dataset.attachTo = menuAttachTo;
  $div.addEventListener('click', onClick);
  $div.addEventListener('dragenter', onDragEnter);
  $div.addEventListener('dragleave', onDragLeave);
  $div.addEventListener('dragover', onDragOver);
  $div.addEventListener('drop', onDrop);

  // Prevent trigger modal dialog closing (when attached to modal)
  ['pointerdown'].forEach((event) => {
    $div.addEventListener(event, (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    });
  });

  $menu = $div;
  return $target.prepend($div);
}

function waitForInjectTarget(maxWait = 10000, interval = 300) {
  const start = Date.now();
  const timer = setInterval(() => {
    const $target = document.querySelector(SELECTORS.insertToBanner);
    if ($target) {
      clearInterval(timer);
      injectButton($target);
    } else if (Date.now() - start > maxWait) {
      log('找不到預期存在的 banner 元素，放棄');
      clearInterval(timer);
    }
  }, interval);
}

function attachMenu(knownTarget) {
  let target;

  if (!$menu) {
    log('menu is gone, re-create it.')
    menuAttachTo = 'banner';
    target = document.querySelector(SELECTORS.insertToBanner);
    injectButton(target);
    return;
  }

  if (menuAttachTo === 'modal') {
    if (knownTarget.checkVisibility()) {
      knownTarget?.appendChild($menu);
    }
  } else {
    target = document.querySelector(SELECTORS.insertToBanner);
    if (target && !target.contains($menu)) {
      target.prepend($menu);
    }
  }
  $menu.dataset.attachTo = menuAttachTo;
}

function modalDialogObserver() {
  const nodes = Array.from(document.querySelectorAll(SELECTORS.modalDialogDetect));
  const dialog = nodes.find(node => node.checkVisibility())?.closest('[role="dialog"]');
  if (dialog) {
    const target = dialog.closest(SELECTORS.insertToModal);
    if (target) {
      if (menuAttachTo !== 'modal') {
        menuAttachTo = 'modal';
        setTimeout(() => {
          attachMenu(target);
        }, 300);
      }
    }
  } else {
    if (menuAttachTo !== 'banner') {
      menuAttachTo = 'banner';
      setTimeout(() => {
        attachMenu();
      }, 300);
    }
  }
}

function findTimestampLinkInDialog(dialog) {
  const maxTry = 8;
  const obfuscationLong = 20;
  const link = Array.from(dialog.querySelectorAll('a[role="link"]')).slice(0, maxTry).find(node => {
    // Assume timestamp link has quirk behavior that:
    // 1. Has real content obfuscation, leads to innerText and textContent mismatch, and innerText got many new lines.
    // 2. (After user mouseover,) the child element will has labelledby by another span.
    const href = node.href || '';
    if (href) {
      const child = node.firstElementChild;
      // console.log('Checking child', child, child.textContent, child.getAttribute('aria-labelledby'));

      if (child) {
        // // Assumption 1
        const innerText = child.innerText;
        if (innerText !== child.textContent && innerText.split('\n').length > obfuscationLong) {
          return true;
        }

        // // Assumption 2
        if (child.ariaLabelledByElements?.[0]) {
          return true;
        }
      }
    }
  });
  return link;
}

async function onClick(e) {
  const $target = e.target;

  const $closeBtn = $target.closest("[data-action='close']");
  if ($closeBtn) {
    if (e.ctrlKey) {
      $menu.style.display = 'none';
    } else {
      showError('請按住 Ctrl 點選關閉（防止誤擊）');
    }
    return;
  }

  const $currentPostBtn = $target.closest("[data-action='current-post']");
  if ($currentPostBtn) {
    let url = getCanonicalUrl(new URL(window.location.href));

    if (!url) {
      const dialog = Array.from(document.querySelectorAll(SELECTORS.modalDialogDetect)).find(node => node.checkVisibility())?.closest('[role="dialog"]');
      if (dialog) {
        const timeLink = findTimestampLinkInDialog(dialog);
        // Still need to check if the link is ready
        if (timeLink) {
          const testUrl = new URL(timeLink.href);
          if (testUrl.pathname === window.location.pathname) {
            showError('時間連結未準備好（需先滑過連結）');
            return;
          }
          url = getCanonicalUrl(timeLink.href);
        }
        if (!url) {
          showError('找不到框內的「時間」連結');
          return;
        }
      }
    }

    if (!url) {
      showError(`偵測失敗，網址不是單篇文章`);
      return;
    }

    await onFetch(url);
    $menu.classList.remove('waiting');
    return;
  }

  $menu.classList.toggle('waiting');
  return;
}

function canDrop(e) {
  const types = e.dataTransfer.types;
  return types.includes('text/plain') || types.includes('text/uri-list');
}

function onDragEnter(e) {
  if (canDrop(e) && $menu === e.target && !$menu.contains(e.relatedTarget)) {
    $menu.classList.add('dragover');
  }
}

function onDragLeave(e) {
  if ($menu === e.target && !$menu.contains(e.relatedTarget)) {
    $menu.classList.remove('dragover');
  }
}

function onDragOver(e) {
  if (canDrop(e)) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
  }
}

async function onDrop(e) {
  if (!canDrop) return;

  e.preventDefault();
  $menu.classList.remove('dragover');

  const dText = e.dataTransfer.getData('text/plain');
  const dUrl  = e.dataTransfer.getData('text/uri-list');
  const url = dUrl || dText;

  try {
    const canonicalUrl = getCanonicalUrl(url);
    if (!canonicalUrl) {
      showError(`未支援這個 URL： ${url}`);
      return;
    }
    await onFetch(canonicalUrl);
    $menu.classList.remove('waiting');
  } catch (error) {
    showError(`解析 URL 失敗（${JSON.stringify(url)}）`);
  }
}

async function onFetch(canonicalUrl) {
  const $text = $menu.querySelector('span[data-text]');
  $text.textContent = '⏳ 取得中…';
  $menu.dataset.disabled = true;

  try {
    pauseVideo();
    await fetchAndShow(canonicalUrl);
  } catch (err) {
    showError(err.message);
  } finally {
    $text.textContent = MENU_TEXT;
    $menu.dataset.disabled = false;
  }
}

function pauseVideo() {
  const $stopBtn = document.querySelector(SELECTORS.videoPauseButton);
  if ($stopBtn) {
    $stopBtn.click();
  }
}

function fetchAndShow(targetUrl) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: 'GET',
      url: targetUrl,
      anonymous: true,   // 不帶 cookie（登入時反而拿不到 title）
      headers: {
        'Accept-Language': 'zh-TW,zh;q=0.9',
        'User-Agent': navigator.userAgent,
      },
      onload(resp) {
        if (resp.status !== 200) {
          reject(new Error(`HTTP ${resp.status}`));
          return;
        }

        const finalUrl = resp.finalUrl ?? targetUrl;
        const doc = new DOMParser().parseFromString(resp.responseText, 'text/html');
        const title = doc.title
          ?? doc.querySelector('meta[property="og:title"]')?.content?.trim();
        // 優先採用 <title>，因 og:title 通常多出「N 次觀看· N 個心情」部分

        showModal({ url: finalUrl, title });
        resolve();
      },
      onerror() {
        reject(new Error('網路請求失敗'));
      },
    });
  });
}

// 產生 <dialog> 內容結構：
//
// <div>
//   <h2>🍖 帶標題的連結</h2>
//   <ul>
//     <li>
//       <strong>URL</strong>
//       <div>
//         <code>...{URL}...</code>
//       </div>
//     </li>
//     <li>
//       <strong>標題</strong>
//       <div>
//         <textarea>...{title}...</textarea>
//       </div>
//     </li>
//     <li>
//       <strong>預覽</strong><div>
//       <div>
//         <div data-preview>
//           <a href="...{URL}..." title="...{title}...">...{title}...</a>
//         </div>
//       </div>
//     </li>
//   </ul>
//   <div class="actions">
//     <button autofocus="">複製</button>
//   </div>
// </div>
function showModal({ url, title }) {
  document.getElementById(DIALOG_ID)?.remove();

  const dialog = document.createElement('dialog');
  dialog.id = DIALOG_ID;

  const content = document.createElement('div');

  const h2 = document.createElement('h2');
  h2.textContent = `${MENU_ICON} ${MENU_TEXT}`;

  const urlDisplay = document.createElement('code');
  urlDisplay.textContent = url;

  const titleDisplay = document.createElement('textarea');
  titleDisplay.value = title;

  const previewAnchor = document.createElement('a');
  previewAnchor.href = url;
  previewAnchor.title = title;
  previewAnchor.textContent = title;

  const previewAnchorBox = document.createElement('div');
  previewAnchorBox.dataset.preview = '';
  previewAnchorBox.appendChild(previewAnchor);

  const items = [
    ['URL',  urlDisplay],
    ['標題', titleDisplay],
    ['預覽', previewAnchorBox],
  ];

  const ul = document.createElement('ul');
  for (const [label, value] of items) {
    const strong = document.createElement('strong');
    strong.textContent = label;

    const div = document.createElement('div');
    if (value instanceof Node) {
      div.appendChild(value);
    } else {
      div.textContent = value;
    }

    const li = document.createElement('li');
    li.append(strong, div);
    ul.appendChild(li);
  }

  const copyBtn = document.createElement('button');
  copyBtn.autofocus = true;
  copyBtn.textContent = '複製';

  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.appendChild(copyBtn);

  content.append(h2, ul, actions);
  dialog.append(content);

  document.body.appendChild(dialog);
  dialog.showModal();

  dialog.addEventListener('click', async (e) => {
    const target = e.target;

    if (target === dialog) {
      dialog.remove();
      return;
    }

    if (target.closest('button')) {
      const html = previewAnchor.outerHTML;
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([html], { type: 'text/plain' }),
        })
      ]);

      copyBtn.textContent = '已複製！';
      await new Promise(r => setTimeout(r, 1800));
      copyBtn.textContent = '複製';
    }
  });

  dialog.addEventListener('cancel', () => dialog.remove());
}

function showError(msg) {
  document.getElementById(ERROR_ID)?.remove();

  const el = document.createElement('div');
  el.id = ERROR_ID;
  el.textContent = `錯誤：${msg}`;
  document.body.appendChild(el);
  log(msg)
  setTimeout(() => el.remove(), 5000);
}

function throttle(func, delay) {
  let timer = null;
  return (...args) => {
    if (timer) return;

    timer = setTimeout(() => {
      func.apply(this, args);
      timer = null;
    }, delay);
  };
};

function log(...args) {
  console.log(`[${LOG_PREFIX}]`, ...args);
}

waitForInjectTarget();

const throttledDialogObserver = throttle(modalDialogObserver, THROTTLE_DELAY);
const observer = new MutationObserver(throttledDialogObserver);
observer.observe(
  document.body,
  {
    childList: true,
    subtree: true
  }
);
