import assert from 'node:assert/strict';
import test from 'node:test';
import { paginateAll } from '../src/paginate.js';

test('--all walks totalPages and concatenates', async () => {
  const calls = [];
  const fetchPage = async (page) => {
    calls.push(page);
    return {
      status: 200,
      body: {
        contacts: [{ id: `c${page}` }],
        pagination: { page, limit: 1, total: 3, totalPages: 3 },
      },
    };
  };

  const result = await paginateAll(fetchPage, {});

  assert.deepEqual(calls, [1, 2, 3]);
  assert.deepEqual(result.value.contacts, [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }]);
  assert.equal(result.value.pagination.totalPages, 3);
});

test('single page when totalPages is 1', async () => {
  const fetchPage = async () => ({
    status: 200,
    body: { contacts: [{ id: 'only' }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } },
  });

  const result = await paginateAll(fetchPage, {});

  assert.deepEqual(result.value.contacts, [{ id: 'only' }]);
});

test('honors 429 retryAfterSeconds by retrying the same page', async () => {
  let attempts = 0;
  const waited = [];
  const fetchPage = async (page) => {
    if (page === 1 && attempts === 0) {
      attempts += 1;
      return { status: 429, body: { retryAfterSeconds: 2 } };
    }
    return {
      status: 200,
      body: { contacts: [{ id: 'c1' }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } },
    };
  };

  const result = await paginateAll(fetchPage, {
    sleep: async (ms) => {
      waited.push(ms);
    },
  });

  assert.deepEqual(waited, [2000]);
  assert.deepEqual(result.value.contacts, [{ id: 'c1' }]);
});

test('stops and reports an error on a non-2xx, non-429 page', async () => {
  const fetchPage = async () => ({ status: 404, body: { error: { code: 'not_found' } } });

  const result = await paginateAll(fetchPage, {});

  assert.equal(result.status, 404);
  assert.equal(result.error.code, 'not_found');
});
