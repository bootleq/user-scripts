// ==UserScript==
// @name              PTT 半自動登入
// @description:zh-TW 在 web PTT 登入畫面顯示獨立的密碼表單，以沿用瀏覽器內建密碼功能登入
// @version           1.0.0
// @license           MIT
// @author            bootleq
// @namespace         bootleq.com
// @homepageURL       https://github.com/bootleq/user-scripts
//
// @match             https://term.ptt.cc/*
// @run-at            document-end
// ==/UserScript==

// References:
// https://github.com/c910335/PTT-Chrome-Auto-Login
// https://greasyfork.org/zh-TW/scripts/35360-term-ptt-autologin
// https://greasyfork.org/zh-TW/scripts/368445-term-ptt-cc-自動登入
// https://greasyfork.org/zh-TW/scripts/372391-pttchrome-term-ptt-cc-add-on
// https://hidde.blog/making-password-managers-play-ball-with-your-login-form/

const loginQuestionClass = 'q7 b0';
const loginQuestionText = '請輸入代號，或以 guest 參觀，或以 new 註冊: '; // 注意末尾有空白
const findQuestionTimeout = 6000;
const containerId = 'PTTSemiLogin';
const dialogHeader = '標準表單登入';
const hideIcon = '--';
const closeIcon = '✖';
const messagePrefix = `[${containerId}] `;

const formHTML = `
  <dialog>
    <div class='header'>
      <span>${dialogHeader}</span>
      <div class='actions'>
        <button data-action="hide" type="button">${hideIcon}</button>
        <button data-action="close" type="button">${closeIcon}</button>
      </div>
    </div>
    <form method="dialog">
      <label>
        代號
        <input type="text" name="id" autocomplete="username" required autofocus>
      </label>
      <label>
        密碼
        <input type="password" name="password" autocomplete="current-password" required>
      </label>

      <button>送出</button>
    </form>
  </dialog>
  `;

const globalStyle = `
  :root {
    --${containerId}-gray-color: rgba(0, 0, 0, 0.6);
  }

  #${containerId} > dialog {
    padding: 0 1.5em 2em;
    font-size: initial;
    overflow: hidden;
    background-color: rgba(255, 255, 255, .85);
    border: 6px solid var(--${containerId}-gray-color);
    border-radius: 15px;
  }

  #${containerId} div.header {
    margin: 0.7em 0 1.9em;
    display: flex;
    justify-content: space-between;
    color: var(--${containerId}-gray-color);
    opacity: 0.6;
  }

  #${containerId} div.actions {
    margin-left: auto;
  }

  #${containerId} div.actions button {
    border: none;
    background: none;
    opacity: 0.6;
  }

  #${containerId} label {
    margin-right: 8px;
    font-weight: normal;
  }

  #${containerId} label > input {
    margin: 0 4px;
  }
`;

const stopPropagation = e => e.stopPropagation();

const findQuestion = () => {
  // 預期登入頁會出現的 HTML 內容：
  // <span class="q7 b0">請輸入代號，或以 guest 參觀，或以 new 註冊: </span>
  let xpath = `//span[@class='${loginQuestionClass}' and text() = '${loginQuestionText}']`;
  let result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  return result.snapshotLength === 1;
};

const waitLoginPage = function (interval, timeout) {
  return new Promise((resolve, reject) => {
    let startTime = Date.now();

    const id = setInterval(() => {
      if (findQuestion()) {
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

const sendEnter = function (input) {
  input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', keyCode: 13, which: 13, bubbles: true}));
};

const doLogin = function (id, password) {
  let $t = document.getElementById('t');

  $t.value = id;
  $t.dispatchEvent(new Event('input'));
  sendEnter($t);

  $t.value = password;
  $t.dispatchEvent(new Event('input'));
  sendEnter($t);
};

const insertLoginForm = function () {
  const $div = document.createElement('div');
  $div.innerHTML = formHTML;
  $div.id = containerId;

  document.body.appendChild($div);

  const $dialog = $div.querySelector('dialog');

  // 避免事件傳遞到頂層 PttChrome 的 handler，焦點管理會錯亂
  ['keydown', 'keyup', 'keypress'].forEach(eventName => {
    $div.addEventListener(eventName, stopPropagation);
  });

  // Submit 按鈕
  $div.querySelector('form').addEventListener('submit', e => {
    let data = new FormData(e.target);

    // Chrome 不會自動偵測到登入，所以用 PasswordCredential 要求儲存；
    // Firefox 目前 (126.0.1) 未支援 PasswordCredential
    if ('PasswordCredential' in window) {
      const cred = {
        id: data.get('id'),
        password: data.get('password')
      };
      navigator.credentials.store(new PasswordCredential(cred));
    }

    doLogin(data.get('id'), data.get('password'));
    destroy();
  });

  // Close 按鈕
  $div.querySelector('button[data-action="close"]').addEventListener('click', () => {
    $dialog.close();
    destroy();
  });

  // Hide 按鈕
  const hideBtn = $div.querySelector('button[data-action="hide"]');
  hideBtn.addEventListener('mousedown', () => { $dialog.style.opacity = 0.05; });
  ['mouseup', 'mouseout'].forEach(eventName => {
    hideBtn.addEventListener(eventName, () => { $dialog.style.opacity = 1; });
  });

  return $dialog;
};

const insertStyle = function (css) {
  const head = document.querySelector('head');
  const style = document.createElement('style');
  style.type = 'text/css';
  style.innerHTML = css;
  head.appendChild(style);
};

const destroy = function () {
  document.getElementById(containerId).remove();
};

const onInit = function () {
  waitLoginPage(500, 5000).then(() => {
    insertStyle(globalStyle);
    let dialog = insertLoginForm();
    dialog.showModal();
  }).catch(() => {
    console.log(`${messagePrefix}`, '找不到「請輸入代號...」文字，放棄登入');
  });
};

onInit();
