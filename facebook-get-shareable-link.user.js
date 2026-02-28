// ==UserScript==
// @name          Facebook 影片標題連結
// @description   在臉書 video/reel 頁面顯示一顆按鈕，提供帶有完整標題、便於分享的 <a> 連結
// @version       1.0.0
// @license       MIT
// @author        bootleq
// @namespace     bootleq.com
// @match         https://www.facebook.com/reel/*
// @match         https://www.facebook.com/*/videos/*
// @match         https://www.facebook.com/watch/*
// @grant         GM_xmlhttpRequest
// @grant         GM_setClipboard
// @grant         GM_addStyle
// @run-at        document-idle
// ==/UserScript==

const ID_PREFIX = 'FB_SHAREABLE';
const BUTTON_ID = `${ID_PREFIX}_BTN`;
const DIALOG_ID = `${ID_PREFIX}_DIALOG`;
const ERROR_ID  = `${ID_PREFIX}_ERROR`;
const BUTTON_INSERT_TO = 'div[role="main"]';
const BG_STYLE = 'linear-gradient( 135deg, #5a1f2b 0%, #7a2d5c 40%, #a12a3a 70%, #d14a6a 100%)';
const BUTTON_TEXT = '🍖帶標題的連結';
const BAD_TITLES = ['Facebook', '影片'];

GM_addStyle(`
  #${BUTTON_ID} {
    position: absolute;
    align-self: end;
    top: 10em;
    margin-right: 0.4em;
    padding: 6px 14px;
    border-radius: 8px;
    border: medium;
    box-shadow: 0 8px 40px rgba(0,0,0,.5);
    background: ${BG_STYLE};
    color: white;
    cursor: pointer;
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

  #${ERROR_ID} {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    background: '#ff4444',
    color: '#fff',
    padding: '12px 20px',
    borderRadius: '10px',
    fontSize: '14px',
    zIndex: '2147483647',
    boxShadow: '0 4px 16px rgba(0,0,0,.2)',
  }
`);

function getCanonicalUrl() {
  const { pathname, search } = location;

  // /reel/{id}
  const reelMatch = pathname.match(/^\/reel\/(\d+)/);
  if (reelMatch) {
    return { videoId: reelMatch[1], canonicalUrl: null, needLookup: true };
  }

  // /watch/?v={id}
  const watchParams = new URLSearchParams(search);
  const watchId = watchParams.get('v');
  if (pathname === '/watch/' || pathname === '/watch') {
    return { videoId: watchId, canonicalUrl: null, needLookup: true };
  }

  // /{page}/videos/{id}/
  const videoMatch = pathname.match(/^\/(.+)\/videos\/(\d+)/);
  if (videoMatch) {
    const canonical = `https://www.facebook.com${pathname}`;
    return { videoId: videoMatch[2], canonicalUrl: canonical, needLookup: false };
  }

  return null;
}


const urlInfo = getCanonicalUrl();
if (!urlInfo) {
  console.log('找不到 canonical URL');
  return;
}


function injectButton($target) {
  if (document.getElementById(BUTTON_ID)) return;

  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.textContent = BUTTON_TEXT;
  btn.addEventListener('click', onButtonClick);

  $target.appendChild(btn);
}

function waitForInjectTarget(maxWait = 10000, interval = 300) {
  const start = Date.now();
  const timer = setInterval(() => {
    const $target = document.querySelector(BUTTON_INSERT_TO);
    if ($target) {
      clearInterval(timer);
      injectButton($target);
    } else if (Date.now() - start > maxWait) {
      console.log('找不到 BUTTON_INSERT_TO，放棄');
      clearInterval(timer);
    }
  }, interval);
}

waitForInjectTarget();


async function onButtonClick() {
  const btn = document.getElementById(BUTTON_ID);
  btn.textContent = '⏳ 取得中…';
  btn.disabled = true;

  try {
    const { canonicalUrl, videoId, needLookup } = urlInfo;

    if (!needLookup) {
      await fetchAndShow(canonicalUrl);
    } else {
      // 需先確認頁面回傳的 canonical（從 <link rel="canonical">）
      // 或直接用 videoId 組出 /videos/ URL 嘗試
      // 先嘗試從當前頁面 canonical meta 取得
      const linkCanonical = document.querySelector('link[rel="canonical"]')?.href;
      const target = linkCanonical
        ? linkCanonical
        : `https://www.facebook.com/video.php?v=${videoId}`;
      await fetchAndShow(target);
    }
  } catch (err) {
    showError(err.message);
  } finally {
    btn.textContent = BUTTON_TEXT;
    btn.disabled = false;
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

        if (!title || BAD_TITLES.includes(title)) {
          reject(new Error(`無法取得完整標題（頁面仍回傳「${title}」）`));
          return;
        }

        showModal({ url: finalUrl, title });
        resolve();
      },
      onerror() {
        reject(new Error('網路請求失敗'));
      },
    });
  });
}


// 樣板：
//
function showModal({ url, title }) {
  document.getElementById(DIALOG_ID)?.remove();

  const dialog = document.createElement('dialog');
  dialog.id = DIALOG_ID;

  const content = document.createElement('div');

  const h2 = document.createElement('h2');
  h2.textContent = BUTTON_TEXT;

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
      copyBtn.textContent = '✅ 已複製！';
      GM_setClipboard(previewAnchor.outerHTML, 'text');
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
  el.textContent = `❌ ${msg}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}
