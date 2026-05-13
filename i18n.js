const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const SUPPORTED = ['en', 'zh-TW', 'zh-CN', 'ja'];
const FALLBACK = 'en';

const bundles = {};
for (const lang of SUPPORTED) {
  try {
    bundles[lang] = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'locales', `${lang}.json`), 'utf8')
    );
  } catch (e) {
    console.error(`Failed to load locale ${lang}:`, e);
    bundles[lang] = {};
  }
}

function detectSystemLanguage() {
  let locale = FALLBACK;
  try {
    if (app && app.getLocale) locale = app.getLocale();
  } catch (_) {}
  if (!locale) return FALLBACK;
  if (locale.toLowerCase().startsWith('zh')) {
    const lower = locale.toLowerCase();
    if (lower.includes('tw') || lower.includes('hant') || lower.includes('hk')) return 'zh-TW';
    return 'zh-CN';
  }
  if (locale.toLowerCase().startsWith('ja')) return 'ja';
  if (locale.toLowerCase().startsWith('en')) return 'en';
  return FALLBACK;
}

function format(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? params[k] : `{${k}}`));
}

function t(lang, key, params) {
  const b = bundles[lang] || bundles[FALLBACK];
  const raw = b[key] || bundles[FALLBACK][key] || key;
  return format(raw, params);
}

function getBundle(lang) {
  return bundles[lang] || bundles[FALLBACK];
}

module.exports = {
  SUPPORTED,
  FALLBACK,
  detectSystemLanguage,
  t,
  getBundle
};
