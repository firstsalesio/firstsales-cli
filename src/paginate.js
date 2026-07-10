// --all auto-paginate: sequential page walk over pagination.totalPages, concatenates.
// Honors 429 retryAfterSeconds by waiting then retrying the same page (no cursor logic).
export async function paginateAll(fetchPage, { limit, sleep = defaultSleep } = {}) {
  let page = 1;
  const results = [];
  let resourceKey = null;
  let lastPagination = null;

  for (;;) {
    const response = await fetchPage(page, limit);
    if (response.status === 429) {
      const retryAfter = response.body?.retryAfterSeconds ?? 1;
      await sleep(retryAfter * 1000);
      continue;
    }
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
