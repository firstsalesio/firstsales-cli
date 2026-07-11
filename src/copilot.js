// `firstsales copilot ask` — post a prompt, poll the session until the
// assistant turn lands, print only the assistant text on stdout (pipeable).
// Progress/approval/audit lines go to stderr. See phase-04 spec.
import { fetchJson } from './http.js';
import { EXIT, exitCodeForStatus } from './exit-codes.js';

const DEFAULT_TIMEOUT_MS = 120_000;
const BACKOFF_START_MS = 1_000;
const BACKOFF_MAX_MS = 5_000;

export async function runCopilotAsk(prompt, flags, config, { log = console.log, err = console.error } = {}) {
  if (!config.apiKey) {
    err('Missing API key. Set FIRSTSALES_API_KEY, pass --api-key, or select a profile.');
    return EXIT.usage;
  }
  const ws = `/api/v1/organizations/${enc(config.org)}/workspaces/${enc(config.workspace)}`;

  let sessionId = flags.session;
  if (!sessionId) {
    const created = await fetchJson(config, { method: 'POST', route: `${ws}/copilot/sessions`, body: {} });
    if (created.status >= 400) {
      err(created.body?.error ?? `Failed to create copilot session (status ${created.status}).`);
      return exitCodeForStatus(created.status);
    }
    // Create returns the session wrapped: { session: { id, ... } }.
    sessionId = created.body.session?.id ?? created.body.id;
  }

  const posted = await fetchJson(config, {
    method: 'POST',
    route: `${ws}/copilot/sessions/${enc(sessionId)}/messages`,
    body: { text: prompt },
  });
  if (posted.status >= 400) {
    err(posted.body?.error ?? `Failed to send message (status ${posted.status}).`);
    return exitCodeForStatus(posted.status);
  }
  const messageId = posted.body.messageId;

  if (flags.noWait) {
    log(JSON.stringify({ sessionId, messageId }));
    return EXIT.ok;
  }

  const timeoutMs = flags.timeout ? Number(flags.timeout) * 1000 : DEFAULT_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  const auditedApprovals = new Set();
  let delay = BACKOFF_START_MS;

  while (true) {
    const session = await fetchJson(config, { method: 'GET', route: `${ws}/copilot/sessions/${enc(sessionId)}` });
    if (session.status >= 400) {
      err(session.body?.error ?? `Failed to fetch session (status ${session.status}).`);
      return exitCodeForStatus(session.status);
    }

    const message = findAssistantReply(session.body.messages ?? [], messageId);
    if (message) {
      if (message.status === 'complete') {
        log(textOf(message));
        if (flags.json) err(JSON.stringify(message));
        return EXIT.ok;
      }
      if (message.status === 'error') {
        err('Copilot turn failed.');
        return EXIT.runtime;
      }
      if (message.status === 'awaiting_approval') {
        // ponytail: the public API has no approval-resolution endpoint — the CLI
        // cannot actually grant approvals server-side, only audit and ask the
        // server (or a human) to decide. Never imply the CLI resolved anything.
        for (const part of message.parts.filter((p) => p.type === 'approval')) {
          const key = `${part.approvalId ?? ''}:${part.toolName ?? ''}`;
          if (!flags.autoApprove) {
            if (!auditedApprovals.has(key)) auditedApprovals.add(key);
            err(`Pending approval required for ${part.toolName ?? 'a tool action'}. Re-run with --auto-approve to allow it.`);
            return EXIT.runtime;
          }
          if (auditedApprovals.has(key)) {
            // Already audited this approval once and it is still pending: the
            // CLI cannot resolve it server-side, so stop polling and fail clearly
            // instead of spinning to a timeout.
            err(
              `Approval ${part.approvalId ?? 'unknown'} for ${part.toolName ?? 'a tool action'} is still pending after --auto-approve audit. The CLI cannot grant approvals; the server (or a human reviewer) must resolve it.`
            );
            return EXIT.runtime;
          }
          auditedApprovals.add(key);
          err(
            `[audit] best-effort auto-approve request logged for ${part.toolName ?? 'tool action'} (approval ${part.approvalId ?? 'unknown'}); the server makes the final decision, not this CLI.`
          );
        }
      } else {
        err(`Waiting on copilot (${message.status})…`);
      }
    } else {
      err('Waiting on copilot…');
    }

    if (Date.now() + delay > deadline) {
      // A poll timeout is a runtime condition, not a "not found" — the session
      // exists, we just gave up waiting on it.
      err(`Timed out after ${timeoutMs / 1000}s waiting for copilot response.`);
      return EXIT.runtime;
    }
    await sleep(delay);
    delay = Math.min(delay + 1_000, BACKOFF_MAX_MS);
  }
}

function findAssistantReply(messages, messageId) {
  const userIndex = messages.findIndex((m) => m.id === messageId);
  const tail = userIndex === -1 ? messages : messages.slice(userIndex + 1);
  const assistantMessages = tail.filter((m) => m.role === 'assistant');
  return assistantMessages[assistantMessages.length - 1];
}

function textOf(message) {
  return message.parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('')
    .trim();
}

function enc(value) {
  return encodeURIComponent(value ?? '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
