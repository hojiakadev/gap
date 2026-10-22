import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInstance } from 'i18next';
import { detectLanguage, LANGUAGES, resources } from '../src/i18n/resources';
import { loadPreferences, savePreferences } from '../src/lib/preferences';

const placeholders = (value: string) =>
  [...value.matchAll(/{{\s*([^},\s]+)/g)].map((match) => match[1]).sort();
test('every interface catalog has the same keys and interpolation placeholders', () => {
  const source = resources.en.translation;
  for (const language of LANGUAGES) {
    const catalog = resources[language].translation;
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(source).sort());
    for (const key of Object.keys(source) as (keyof typeof source)[]) {
      assert.ok(catalog[key].trim(), `Empty ${language}: ${key}`);
      assert.deepEqual(
        placeholders(catalog[key]),
        placeholders(source[key]),
        `${language}: ${key}`,
      );
    }
  }
});
test('saved language precedes browser detection, regional variants work, and unsupported languages fall back', () => {
  assert.equal(detectLanguage('uz', ['ru-RU', 'en-US']), 'uz');
  assert.equal(detectLanguage(undefined, ['ru-RU', 'en-US']), 'ru');
  assert.equal(detectLanguage(undefined, ['uz-Latn-UZ']), 'uz');
  assert.equal(detectLanguage('invalid', ['de-DE', 'en-GB']), 'en');
  assert.equal(detectLanguage(undefined, ['ja-JP']), 'en');
});
test('plural rules and interpolated values work for all three languages', async () => {
  const instance = createInstance();
  await instance.init({
    resources,
    lng: 'ru',
    fallbackLng: 'en',
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
  });
  assert.equal(instance.t('lineCount', { count: 1 }), '1 строка');
  assert.equal(instance.t('lineCount', { count: 2 }), '2 строки');
  assert.equal(instance.t('lineCount', { count: 5 }), '5 строк');
  assert.equal(instance.t('expiresIn', { count: 21 }), 'Закроется через 21 минуту');
  assert.equal(instance.t('Replying to {{name}}', { name: '<Alex>' }), 'Ответ для <Alex>');
  await instance.changeLanguage('uz');
  assert.equal(instance.t('Create a tunnel'), 'Tunnel yaratish');
  assert.equal(instance.t('lineCount', { count: 5 }), '5 qator');
  await instance.changeLanguage('en');
  assert.equal(instance.t('lineCount', { count: 1 }), '1 line');
  assert.equal(instance.t('lineCount', { count: 2 }), '2 lines');
});
test('all known relay errors and room termination reasons have translations', () => {
  const relay = readFileSync(new URL('../server/relay.ts', import.meta.url), 'utf8');
  const keys = resources.en.translation;
  for (const match of relay.matchAll(
    /error:\s*'([^']+)'|destroyRoom\(\s*(?:code|room.code),\s*'([^']+)'/g,
  )) {
    const text = match[1] ?? match[2];
    assert.ok(Object.hasOwn(keys, text), `Untranslated relay message: ${text}`);
  }
});
test('saving language preserves name and theme and never adds message history', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let stored = JSON.stringify({ name: 'Ali', mode: 'dark', history: ['must not persist'] });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => stored,
      setItem: (_key: string, value: string) => {
        stored = value;
      },
    },
  });
  try {
    savePreferences({ language: 'uz' });
    assert.deepEqual(JSON.parse(stored), { name: 'Ali', mode: 'dark', language: 'uz' });
    savePreferences({ name: 'Sam' });
    assert.deepEqual(loadPreferences(), { name: 'Sam', mode: 'dark', language: 'uz' });
    stored = '{"language":"unsupported"}';
    assert.equal(loadPreferences().language, undefined);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
