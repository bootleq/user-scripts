// ==UserScript==
// @name              Facebook 鍵盤捲頁
// @description       在臉書使用鍵盤 PageDown 捲動
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

const scrollBehavior = 'smooth';  // auto | smooth
const scrollOffset = 50;    // Reverse offset to make a smaller page distance
const ignoreWindow = true;  // If true, do not handle the whole window (only handle dialogs)
const ignoreDialogs = [     // Don't scroll those dialogs were detected, scroll the window instead
  '心情',
  '通知',
  '相片檢視工具',
];

function isScrollable(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return (
    el.scrollHeight > el.clientHeight &&
    style.overflowY !== 'visible' &&
    el.clientHeight > 100 &&
    el.scrollHeight > window.innerHeight / 2
  );
}

function findScrollable(root, maxDepth = 5) {
  // console.log('findScrollable', root);
  if (!root || maxDepth < 1) return null;

  const queue = [{ element: root, depth: 0 }];

  while (queue.length > 0) {
    const { element, depth } = queue.shift();

    if (isScrollable(element)) {
      return element;
    }

    if (depth >= maxDepth) continue;

    const childDivs = element.querySelectorAll(':scope > div');
    for (let child of childDivs) {
      queue.push({ element: child, depth: depth + 1 });
    }
  }

  return null;
}

function init() {
  document.addEventListener('keydown', function(e) {
    const $active = document.activeElement;

    // Skip if has editing content
    if ($active.contentEditable.toString === 'true' && $active.textContent.length > 0) {
      return;
    }

    const isPageDown = (e.key === 'PageDown' || e.keyCode === 34);
    const isPageUp = (e.key === 'PageUp' || e.keyCode === 33);

    if (isPageDown || isPageUp) {
      let $target = null;

      const $dialog = document.querySelector('[role="dialog"][aria-labelledby]');

      if (
        $dialog &&
        !ignoreDialogs.includes($dialog.ariaLabel) &&
        $dialog.clientHeight > window.innerHeight * 0.25
      ) {
        // console.log('DIALOG', $dialog, $dialog.ariaLabel);
        $target = findScrollable($dialog, 5);
      } else {
        if (!ignoreWindow) {
          $target = window;
        }
      }

      if ($target) {
        e.preventDefault(); // sometimes the default works, prevent it to unify behavior

        const direction = isPageDown ? 1 : -1;
        const distance = direction * window.innerHeight - scrollOffset;

        $target.scrollBy({
          top: distance,
          behavior: scrollBehavior,
        });
      }
    }
  });
}

init();
