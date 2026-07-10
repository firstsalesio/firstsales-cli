const MAX_RETRIES_PER_PAGE = 5;

// --all auto-paginate: sequential page walk over pagination.totalPages, concatenates.
// Honors 429 retryAfterSeconds by waiting then retrying the same page (no cursor logic).
// Retries are capped per page; exhausting them surfaces a rate-limited (429) result
// instead of looping forever.
export async function paginateAll(fetchPage, { limit, sleep = defaultSleep, maxRetries = MAX_RETRIES_PER_PAGE } = {}) {
  let page = 1;
  const results = [];
  let resourceKey = null;
  let lastPagination = null;
  let retries = 0;

  for (;;) {
    const response = await fetchPage(page, limit);
    if (response.status === 429) {
      retries += 1;
      if (retries > maxRetries) {
        return {
          error: response.body?.error ?? {
            code: 'rate_limited',
            message: `Gave up after ${maxRetries} retries on page ${page} (429).`,
          },
          status: 429,
        };
      }
      const retryAfter = response.body?.retryAfterSeconds ?? 1;
      await sleep(retryAfter * 1000);
      continue;
    }
    retries = 0;
    if (response.status >= 400) {
      return {
        error: response.body?.error ?? {
          code: 'request_failed',
          message: `Request failed with status ${response.status}.`,
        },
        status: response.status,
      };
    }
    const body = response.body ?? {};
    resourceKey = resourceKey ?? Object.keys(body).find((key) => Array.isArray(body[key])) ?? 'items';
    results.push(...(body[resourceKey] ?? []));
    lastPagination = body.pagination ?? null;
    if (!lastPagination || page >= lastPagination.totalPages) {
      return { value: { [resourceKey]: results, pagination: lastPagination }, status: 200 };
    }
    page += 1;
  }
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
