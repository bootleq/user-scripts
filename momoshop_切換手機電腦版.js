// ==UserScript==
// @name              momoshop.com.tw 切換手機／電腦版
// @description       Add link button to specific pages, to switch between mobile/desktop site
// @description:zh-TW 在特定網頁增加連結按鈕，以切換至手機／電腦版網站
// @version           1.0.0
// @license           MIT
// @author            bootleq
// @homepageURL       https://github.com/bootleq/user-scripts
//
// @match             https://*.momoshop.com.tw/*
// @run-at            document-end
// ==/UserScript==

const detectMobile = true; // 啟用轉換 手機 → 桌面版
const detectDesktop = false; // 啟用轉換 桌面 → 手機版

const adapterHTML = function (url, text) {
  return `
      <span>👀</span>
      <a href="${url}">${text}</a>
      <button onclick="console.log(this.parentNode.style.display = 'none')">✖</button>`;
};

const adapterClass = 'momo-bad-view-adapter';

const globalStyle = `
  .${adapterClass} {
    position: fixed;
    top: 12%;
    right: 10px;
    display: flex;
    align-items: center;
    z-index: 999;
    font-size: larger;
    color: white;
    background-color: rgba(214, 0, 109, 0.8);
    margin: 6px;
    padding-left: 10px;
    border-radius: 30px 0 0 24px;
    box-shadow: 4px 4px 6px rgba(0,0,0,.6);
    animation: ${adapterClass}-breathing 2100ms infinite normal, ${adapterClass}-slowmo 4500ms infinite reverse;
  }

  .${adapterClass} > span {
    animation: ${adapterClass}-blink 2800ms infinite normal;
    margin-top: -4px;
  }

  .${adapterClass} > a {
    color: white;
    padding: 1em 0 1em 22px;
    text-shadow: 1px 1px 1px #333;
  }

  .${adapterClass} > button {
    cursor: pointer;
    background: none;
    border: none;
    margin: 0 20px 0 10px;
    font-size: x-large;
  }

  @keyframes ${adapterClass}-breathing {
    0%   { background-color: rgba(214, 0, 109, 0.8); }
    70%  { background-color: rgba(214, 0, 109, 0.8); }
    90%  { background-color: rgba(214, 0, 109, 0.7); }
    100% { background-color: rgba(214, 0, 109, 0.75); }
  }
  @keyframes ${adapterClass}-slowmo {
    0%   { padding-right: 0; }
    50%  { padding-right: 2px; }
    100% { padding-right: -2px; }
  }
  @keyframes ${adapterClass}-blink {
    0%  { transform: scaleY(1); }
    90% { transform: scaleY(1); }
    92% { transform: scaleY(0); }
    94% { transform: scaleY(1); }
    97% { transform: scaleY(0); }
    99% { transform: scaleY(1); }
  }
`;

const hosts = {
  mobile: 'm.momoshop.com.tw',
  desktop: 'www.momoshop.com.tw',
};

const adapterText = {
  mobile: '切換至桌面版',
  desktop: '切換至手機版'
};

const routes = {
  mobile: [
    {
      name: 'search',
      path: '/search.momo',
      key:  'searchKeyword'
    },
    {
      name: 'goods',
      path: '/goods.momo',
      key:  'i_code'
    }
  ],
  desktop: [
    {
      name: 'search',
      path: '/search/searchShop.jsp',
      key:  'keyword'
    },
    {
      name: 'goods',
      path: '/goods/GoodsDetail.jsp',
      key:  'i_code'
    }
  ]
};

const findRouteByPath = function (view, urlPath) {
  return routes[view].find(({path}) => urlPath.startsWith(path));
};

const findRouteByName = function (view, routeName) {
  return routes[view].find(({name}) => name === routeName);
};

const adapterURL = function (url, route, view) {
  const toView = view === 'mobile' ? 'desktop' : 'mobile';
  const params = url.searchParams;

  const id = params.get(route.key);
  if (!id) {
    console.error(`解析網址失敗，缺少 ${route.key} 參數`);
  }

  const toRoute = findRouteByName(toView, route.name);

  // NOTE: don't try to keep params like below, the result URL usually not work
  // params.delete(route.key);
  // params.set(toRoute.key, id);
  // return `https://${hosts[toView]}${toRoute.path}?${params.toString()}`;

  return `https://${hosts[toView]}${toRoute.path}?${toRoute.key}=${id}`;
};

const insertAdapter = function (url, text) {
  const target = document.querySelector('body');
  const $div = document.createElement('div');
  $div.innerHTML = adapterHTML(url, text);
  $div.classList.add(adapterClass);
  return target.appendChild($div);
}

const insertStyle = function (css) {
  const head = document.querySelector('head');
  const style = document.createElement('style');
  style.type = 'text/css';
  style.innerHTML = css;
  head.appendChild(style);
};

const onInit = function () {
  const url = new URL(window.location);
  const view = url.host.startsWith('m.') ? 'mobile' : 'desktop';

  if (view === 'mobile' && !detectMobile || view === 'desktop' && !detectDesktop) {
    return;
  }

  const route = findRouteByPath(view, url.pathname);

  if (route) {
    insertStyle(globalStyle);
    const newURL = adapterURL(url, route, view);
    insertAdapter(newURL, adapterText[view]);
  } else {
    console.log('未支援的網址');
  }
};

window.addEventListener('DOMContentLoaded', onInit);
