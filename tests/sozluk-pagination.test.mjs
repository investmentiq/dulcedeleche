import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const frontend = await readFile(new URL('../experiments/sozluk-okuru/app.js', import.meta.url), 'utf8');
const worker = await readFile(new URL('../services/sozluk-okuru-api/worker.js', import.meta.url), 'utf8');

function client(search) {
  const app = { innerHTML: '' };
  const context = vm.createContext({
    URL, URLSearchParams, Intl, console,
    location: { search },
    localStorage: { getItem: () => null },
    document: { querySelector: s => s === '#app' ? app : null, documentElement: { dataset: {} } },
  });
  // Suppress only startup: tests invoke the real render path explicitly.
  vm.runInContext(frontend.replace(/render\(\);\s*$/, ''), context);
  return { context, app };
}

function bridge(fetchUpstream) {
  const context = vm.createContext({ URL, URLSearchParams, Request, Response, crypto, TextEncoder, btoa, fetch: fetchUpstream });
  vm.runInContext(worker.replace('export default {', 'globalThis.worker = {'), context);
  // Reuse an anonymous session so these tests isolate pagination, not authentication.
  vm.runInContext('authCache = { token: "test", secret: "test", expires: Date.now() + 3600000 };', context);
  return context;
}

test('both parsers preserve high pages and existing input normalization', () => {
  for (const [value, expected] of [[null,1], ['',1], ['bad',1], ['Infinity',1], ['-2',1], ['0',1], ['1',1], ['249',249], ['250',250], ['251',251], ['305',305], ['5000',5000], ['305.9',305]]) {
    const { context } = client(value === null ? '' : '?page=' + encodeURIComponent(value));
    assert.equal(vm.runInContext('pageValue()', context), expected);
    const api = bridge(() => { throw Error('unexpected fetch'); });
    api.value = value;
    assert.equal(vm.runInContext('clampPage(value)', api), expected);
  }
});

test('topic rendering reaches upstream unchanged and pagers cross 250', async () => {
  // A deterministic 400-page topic fixture; live upstream checks are separate.
  for (const page of [1, 249, 250, 251, 305, 306, 400]) {
    const api = bridge(async url => {
      assert.equal(url, `https://api.eksisozluk.com/v2/topic/998540?p=${page}`);
      return Response.json({ Success: true, Data: { Id:998540, Title:'pagination fixture', PageIndex:page, PageCount:400, Entries:[{Id:page, Content:`entry on page ${page}`}], EntryCounts:{Total:4000} } });
    });
    const { context, app } = client(`?topic=998540&page=${page}`);
    context.fetch = url => api.worker.fetch(new Request(url));
    await vm.runInContext('render()', context);
    assert.match(app.innerHTML, new RegExp(`value="${page}"`));
    assert.match(app.innerHTML, new RegExp(`entry on page ${page}`));
    assert.match(app.innerHTML, /max="400"/);
    if (page < 400) assert.ok(app.innerHTML.includes(`?topic=998540&page=${page+1}`));
    if (page > 1) assert.ok(app.innerHTML.includes(`?topic=998540&page=${page-1}`));
  }
});

test('current-day jump still finds entries beyond page 250', async () => {
  const { context } = client('?topic=998540');
  const requests = [];
  const today = new Date().toISOString();
  const data = page => ({ PageIndex:page, PageCount:400, Entries:[{Id:page, Created:page >= 305 ? today : '2000-01-01T12:00:00Z'}] });
  context.fetch = async url => {
    const page = Number(new URL(url).searchParams.get('page'));
    requests.push(page);
    return Response.json({ok:true,data:data(page)});
  };
  context.first = data(1);
  const located = await vm.runInContext('locateCurrentDay(998540, first)', context);
  assert.equal(located.data.PageIndex, 305);
  assert.equal(located.entryId, 305);
  assert.ok(requests.some(p => p > 250));
});
