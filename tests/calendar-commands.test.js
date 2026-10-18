import assert from 'node:assert/strict';
import test from 'node:test';
import { listCommands } from '../src/commands.js';
import { runCli, startApi } from './helpers.js';

const env = (url) => ({ FIRSTSALES_API_KEY: 'fs-test-env', FIRSTSALES_BASE_URL: url });
const base = ['--json', '--org', 'org_1', '--workspace', 'ws_1'];
const prefix = '/api/v1/organizations/org_1/workspaces/ws_1/calendar';
const ws = '/api/v1/organizations/{org}/workspaces/{workspace}';

const cases = [
  [['meetings', 'schedules'], 'GET', `${prefix}/schedules`],
  [
    ['meetings', 'routing-form-publish', '--form', 'demo', '--data', '{"fields":[]}'],
    'POST',
    `${prefix}/routing-forms/demo`,
  ],
  [
    ['meetings', 'template-preview', '--template', 'intro'],
    'GET',
    `${prefix}/templates/intro/preview`,
  ],
];

for (const [args, method, url] of cases) {
  test(`${args.slice(0, 2).join(' ')} calls ${method} ${url}`, async () => {
    const api = await startApi(async () => ({ status: 200, body: { data: [] } }));
    try {
      const result = await runCli([...args, ...base], env(api.url));
      assert.equal(result.code, 0, result.stdout);
      assert.equal(api.requests.length, 1);
      assert.equal(api.requests[0].method, method);
      assert.equal(api.requests[0].url, url);
      const dataIndex = args.indexOf('--data');
      if (dataIndex !== -1) {
        assert.deepEqual(JSON.parse(api.requests[0].body), JSON.parse(args[dataIndex + 1]));
      }
    } finally {
      await api.close();
    }
  });
}

for (const [args, flag] of [
  [['meetings', 'routing-form-publish', '--data', '{"fields":[]}'], 'form'],
  [['meetings', 'template-preview'], 'template'],
]) {
  test(`${args.slice(0, 2).join(' ')} requires --${flag} before sending a request`, async () => {
    const api = await startApi(async () => ({ status: 200, body: { data: {} } }));
    try {
      const result = await runCli([...args, ...base], env(api.url));
      assert.equal(result.code, 2, result.stdout);
      assert.equal(JSON.parse(result.stdout).error.code, 'missing_required_flag');
      assert.match(result.stdout, new RegExp(`--${flag}`));
      assert.equal(api.requests.length, 0);
    } finally {
      await api.close();
    }
  });
}

test('meetings routing-form-publish refuses to send without a body', async () => {
  const api = await startApi(async () => ({ status: 200, body: { data: {} } }));
  try {
    const result = await runCli(['meetings', 'routing-form-publish', '--form', 'demo', ...base], env(api.url));
    assert.equal(result.code, 2, result.stdout);
    assert.equal(JSON.parse(result.stdout).error.code, 'missing_required_body');
    assert.match(result.stdout, /--data or --data-file/);
    assert.equal(api.requests.length, 0);
  } finally {
    await api.close();
  }
});

test('schedules, routing-form-publish and template-preview publish their full command records', () => {
  const byLabel = new Map(listCommands().map((entry) => [entry.command, entry]));
  assert.deepEqual(byLabel.get('meetings schedules'), {
    command: 'meetings schedules',
    method: 'GET',
    path: `${ws}/calendar/schedules`,
    destructive: false,
    required: ['org', 'workspace'],
  });
  assert.deepEqual(byLabel.get('meetings routing-form-publish'), {
    command: 'meetings routing-form-publish',
    method: 'POST',
    path: `${ws}/calendar/routing-forms/{form}`,
    destructive: false,
    required: ['org', 'workspace', 'form'],
    bodyRequired: true,
  });
  assert.deepEqual(byLabel.get('meetings template-preview'), {
    command: 'meetings template-preview',
    method: 'GET',
    path: `${ws}/calendar/templates/{template}/preview`,
    destructive: false,
    required: ['org', 'workspace', 'template'],
  });
});

for (const [args, method, url, response] of [
  [['meetings', 'organization-catalog'], 'GET', `${prefix}/organization-catalog`, { catalog: null }],
  [
    ['meetings', 'organization-profile'],
    'GET',
    `${prefix}/organization-profile`,
    { profile: { revision: 0, published: null, handles: [], aliases: [] } },
  ],
  [
    ['meetings', 'template-publish', '--template', 'intro', '--data', '{"fields":{}}'],
    'POST',
    `${prefix}/templates/intro`,
    { data: {} },
  ],
  [['meetings', 'template-apply', '--template', 'intro'], 'POST', `${prefix}/templates/intro/apply`, { data: {} }],
]) {
  test(`${args.slice(0, 2).join(' ')} sends one ${method} ${url} and prints the reply`, async () => {
    const api = await startApi(async () => ({ status: 200, body: response }));
    try {
      const result = await runCli([...args, ...base], env(api.url));
      assert.equal(result.code, 0, result.stdout);
      assert.equal(api.requests.length, 1);
      assert.equal(api.requests[0].method, method);
      assert.equal(api.requests[0].url, url);
      const dataIndex = args.indexOf('--data');
      if (dataIndex === -1) {
        assert.equal(api.requests[0].body, '');
      } else {
        assert.deepEqual(JSON.parse(api.requests[0].body), JSON.parse(args[dataIndex + 1]));
      }
      assert.deepEqual(JSON.parse(result.stdout), response);
    } finally {
      await api.close();
    }
  });
}

for (const args of [
  ['meetings', 'organization-catalog'],
  ['meetings', 'organization-profile'],
  ['meetings', 'template-publish', '--template', 'intro', '--data', '{"fields":{}}'],
  ['meetings', 'template-apply', '--template', 'intro'],
]) {
  test(`${args.slice(0, 2).join(' ')} requires --org and --workspace before sending a request`, async () => {
    const api = await startApi(async () => ({ status: 200, body: { data: {} } }));
    try {
      for (const [scope, flag] of [
        [['--workspace', 'ws_1'], /--org/],
        [['--org', 'org_1'], /--workspace/],
      ]) {
        const result = await runCli([...args, '--json', ...scope], env(api.url));
        assert.equal(result.code, 2, result.stdout);
        assert.equal(JSON.parse(result.stdout).error.code, 'missing_required_flag');
        assert.match(JSON.parse(result.stdout).error.message, flag);
      }
      assert.equal(api.requests.length, 0);
    } finally {
      await api.close();
    }
  });
}

for (const args of [
  ['meetings', 'template-publish', '--data', '{"fields":{}}'],
  ['meetings', 'template-apply'],
]) {
  test(`${args.slice(0, 2).join(' ')} requires --template before sending a request`, async () => {
    const api = await startApi(async () => ({ status: 200, body: { data: {} } }));
    try {
      const result = await runCli([...args, ...base], env(api.url));
      assert.equal(result.code, 2, result.stdout);
      assert.equal(JSON.parse(result.stdout).error.code, 'missing_required_flag');
      assert.match(result.stdout, /--template/);
      assert.equal(api.requests.length, 0);
    } finally {
      await api.close();
    }
  });
}

for (const dryRun of [false, true]) {
  test(`meetings template-publish refuses to send without a body${dryRun ? ' in dry-run' : ''}`, async () => {
    const api = await startApi(async () => ({ status: 200, body: { data: {} } }));
    try {
      const args = ['meetings', 'template-publish', '--template', 'intro', ...base, ...(dryRun ? ['--dry-run'] : [])];
      const result = await runCli(args, env(api.url));
      assert.equal(result.code, 2, result.stdout);
      assert.equal(JSON.parse(result.stdout).error.code, 'missing_required_body');
      assert.match(result.stdout, /--data or --data-file/);
      assert.equal(api.requests.length, 0);
    } finally {
      await api.close();
    }
  });
}

test('organization-catalog, organization-profile, template-publish and template-apply each publish one full command record', () => {
  const commands = listCommands();
  for (const record of [
    {
      command: 'meetings organization-catalog',
      method: 'GET',
      path: `${ws}/calendar/organization-catalog`,
      destructive: false,
      required: ['org', 'workspace'],
    },
    {
      command: 'meetings organization-profile',
      method: 'GET',
      path: `${ws}/calendar/organization-profile`,
      destructive: false,
      required: ['org', 'workspace'],
    },
    {
      command: 'meetings template-publish',
      method: 'POST',
      path: `${ws}/calendar/templates/{template}`,
      destructive: false,
      required: ['org', 'workspace', 'template'],
      bodyRequired: true,
    },
    {
      command: 'meetings template-apply',
      method: 'POST',
      path: `${ws}/calendar/templates/{template}/apply`,
      destructive: false,
      required: ['org', 'workspace', 'template'],
    },
  ]) {
    assert.deepEqual(
      commands.filter((entry) => entry.command === record.command),
      [record]
    );
  }
});
