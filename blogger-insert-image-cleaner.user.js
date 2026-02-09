// ==UserScript==
// @name         清理 Blogger 插入圖片冗碼
// @description  用編輯器插入圖片後，轉換預設產生的 HTML
// @version      0.1.0
// @license      MIT
// @author       bootleq
// @namespace    bootleq.com
// @homepageURL  https://github.com/bootleq/user-scripts
//
// @match        https://www.blogger.com/blog/post/edit/*
// @run-at       document-idle
// @grant        none
// @noframes
// ==/UserScript==

'use strict';

const maxInitRetry = 8;
const insertedTarget = /<div\s+class="separator" style=[^>]*>[\s\S]*?<\/div>/g;
const generatorFn = null; // See `defaultGenerator` function

let retryCount = 0;

function extractBasename(src) {
  const parts = src.split('/');
  const filename = parts[parts.length - 1];
  const basename = filename.replace(/\.[^.]*$/, '');

  if (/%[0-9A-Fa-f]{2}/.test(basename)) {
    try {
      const decoded = decodeURIComponent(basename);
      return decoded;
    } catch (e) {
      return basename;
    }
  }
  return basename;
}

function parseProps(html) {
  try {
    const hrefMatch = html.match(/<a\s+[^>]*href="([^"]+)"/);
    if (!hrefMatch) return null;
    const href = hrefMatch[1];

    const imgMatch = html.match(/<img[^>]*>/);
    if (!imgMatch) return null;
    const imgTag = imgMatch[0];

    const srcMatch = imgTag.match(/src="([^"]+)"/);
    const widthMatch = imgTag.match(/width="(\d+)"/);
    const heightMatch = imgTag.match(/height="(\d+)"/);
    const originalWidthMatch = imgTag.match(/data-original-width="(\d+)"/);
    const originalHeightMatch = imgTag.match(/data-original-height="(\d+)"/);
    const altMatch = imgTag.match(/alt="([^"]*)"/);

    const src = srcMatch?.[1];
    const basename = extractBasename(src || '');

    if (!srcMatch || !(originalWidthMatch || originalHeightMatch)) {
      return null;
    }

    return {
      href: href,
      src,
      basename,
      width: widthMatch ? parseInt(widthMatch[1]) : null,
      height: heightMatch ? parseInt(heightMatch[1]) : null,
      originalWidth: parseInt(originalWidthMatch[1]),
      originalHeight: parseInt(originalHeightMatch[1]),
      alt: altMatch ? altMatch[1] : null,
    };
  } catch (e) {
    console.error('Parsing error:', e);
    return null;
  }
}

function calculateDimensions(data) {
  const { originalWidth, originalHeight } = data;
  const aspectRatio = originalHeight / originalWidth;

  let width, height;

  if (data.width) {
    width = data.width;
    height = Math.round(width * aspectRatio);
  } else if (data.height) {
    height = data.height;
    width = Math.round(height / aspectRatio);
  } else {
    width = originalWidth;
    height = originalHeight;
  }

  return { width, height };
}

function defaultGenerator(data) {
  const { href, src, basename, width, height, originalWidth, originalHeight, alt } = data;
  return `<a href="${href}"><img alt="${alt || basename}" width="${width}" height="${height}" loading="lazy" data-original-width="${originalWidth}" data-original-height="${originalHeight}" src="${src}"/></a>\n`;
}

function replacer(text) {
  if (!text.includes('<a href=') || !text.includes('<img')) {
    return text;
  }

  const parsed = parseProps(text);
  if (!parsed) {
    return text;
  }

  const genFn = typeof generatorFn === 'function' ? generatorFn : defaultGenerator;
  const dimensions = calculateDimensions(parsed);
  const result = genFn({
    ...parsed,
    ...dimensions
  });

  return result;
}

function init() {
  retryCount += 1;

  if (retryCount > maxInitRetry) {
    console.log(`已重試初始化 ${maxInitRetry} 次，放棄`);
    return;
  }

  const $editor = document.querySelector('div.CodeMirror');

  if (!$editor || !$editor.CodeMirror) {
    setTimeout(init, 800);
    return;
  }

  const cm = $editor.CodeMirror;

  cm.on('beforeChange', (instance, changeObj) => {
    const { origin, text } = changeObj;
    if (changeObj.origin !== '+input') return;

    const line = text.join('\n');
    const matches = line.match(insertedTarget);

    if (matches) {
      const result = line.replaceAll(insertedTarget, (match) => replacer(match));

      changeObj.update(
        null,
        null,
        result.split('\n')
      );
    }
  });
}

init();
