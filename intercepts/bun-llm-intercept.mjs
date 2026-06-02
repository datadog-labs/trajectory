import {
  buildLLMCallEvent,
  computeDurationMs,
  computeTTFBMs,
  extractTokenUsageFromSSEEvents,
  nowHrtimeNs,
  parseSSEStream,
  postLLMCallEvent,
  resolveSessionId,
} from './intercept-shared.mjs';

const INTERCEPT_GUARD = Symbol.for('trajectory-intercepted');

function getRequestURL(input) {
  if (typeof input === 'string') {
    return input;
  }
  if (input && typeof input.url === 'string') {
    return input.url;
  }
  return '';
}

function shouldIntercept(url) {
  if (typeof url !== 'string' || url.length === 0) {
    return false;
  }
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'api.anthropic.com') {
      return true;
    }
    // dd-apm-test-agent also instruments custom Anthropic-compatible gateways
    // by matching Anthropic API paths instead of only the public API host.
    return /^\/v1\/(messages|complete)(\/|$)/.test(parsed.pathname);
  } catch {
    return false;
  }
}

function parseJsonSafe(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    // Silent by design.
  }
  return {};
}

function parseBodyFromInit(init) {
  const body = init?.body;

  if (typeof body === 'string') {
    return Promise.resolve(parseJsonSafe(body));
  }

  if (body && typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    return Promise.resolve(parseJsonSafe(body.toString()));
  }

  if (body && typeof body === 'object' && typeof body.byteLength === 'number') {
    try {
      const decoder = new TextDecoder();
      return Promise.resolve(parseJsonSafe(decoder.decode(body)));
    } catch {
      return Promise.resolve({});
    }
  }

  return null;
}

function extractRequestBody(input, init) {
  const fromInit = parseBodyFromInit(init);
  if (fromInit) {
    return fromInit;
  }

  if (typeof Request !== 'undefined' && input instanceof Request) {
    try {
      return input
        .clone()
        .text()
        .then((text) => parseJsonSafe(text))
        .catch(() => ({}));
    } catch {
      return Promise.resolve({});
    }
  }

  return Promise.resolve({});
}

function isNonEmpty(value) {
  if (typeof value === 'string') {
    return value.length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return Boolean(value);
}

function extractRequestSummary(body) {
  const request = body && typeof body === 'object' ? body : {};
  const messages = Array.isArray(request.messages) ? request.messages : [];
  const tools = Array.isArray(request.tools) ? request.tools : [];
  const toolResultIds = [];

  for (const message of messages) {
    const content = message?.content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const block of content) {
      if (block?.type === 'tool_result' && typeof block?.tool_use_id === 'string') {
        toolResultIds.push(block.tool_use_id);
      }
    }
  }

  return {
    message_count: messages.length,
    system_present: isNonEmpty(request.system),
    tools_count: tools.length,
    max_tokens: Number.isFinite(request.max_tokens) ? Math.trunc(request.max_tokens) : 0,
    has_tool_results: toolResultIds.length > 0,
    tool_result_ids: toolResultIds,
  };
}

function extractResponseSummary(events) {
  const contentBlockTypes = new Set();
  const toolUseIds = new Set();
  const toolUseNames = new Set();
  let textLength = 0;
  let thinkingLength = 0;

  for (const event of Array.isArray(events) ? events : []) {
    const eventType = event?.event || event?.data?.type || '';
    const data = event?.data;

    if (eventType === 'content_block_start') {
      const block = data?.content_block;
      if (typeof block?.type === 'string' && block.type.length > 0) {
        contentBlockTypes.add(block.type);
      }
      if (block?.type === 'tool_use') {
        if (typeof block?.id === 'string' && block.id.length > 0) {
          toolUseIds.add(block.id);
        }
        if (typeof block?.name === 'string' && block.name.length > 0) {
          toolUseNames.add(block.name);
        }
      }
      continue;
    }

    if (eventType === 'content_block_delta') {
      const delta = data?.delta;
      if (typeof delta?.type === 'string' && delta.type === 'text_delta') {
        contentBlockTypes.add('text');
        if (typeof delta?.text === 'string') {
          textLength += delta.text.length;
        }
      }
      if (typeof delta?.type === 'string' && delta.type === 'thinking_delta') {
        contentBlockTypes.add('thinking');
        if (typeof delta?.thinking === 'string') {
          thinkingLength += delta.thinking.length;
        }
      }
    }
  }

  return {
    content_block_types: Array.from(contentBlockTypes),
    tool_use_ids: Array.from(toolUseIds),
    tool_use_names: Array.from(toolUseNames),
    text_length: textLength,
    thinking_length: thinkingLength,
  };
}

function extractResponseSummaryFromMessage(payload) {
  const contentBlockTypes = new Set();
  const toolUseIds = new Set();
  const toolUseNames = new Set();
  let textLength = 0;
  let thinkingLength = 0;

  const content = Array.isArray(payload?.content) ? payload.content : [];
  for (const block of content) {
    if (typeof block?.type === 'string' && block.type.length > 0) {
      contentBlockTypes.add(block.type);
    }
    if (block?.type === 'tool_use') {
      if (typeof block?.id === 'string' && block.id.length > 0) {
        toolUseIds.add(block.id);
      }
      if (typeof block?.name === 'string' && block.name.length > 0) {
        toolUseNames.add(block.name);
      }
    }
    if (block?.type === 'text' && typeof block?.text === 'string') {
      textLength += block.text.length;
    }
    if (block?.type === 'thinking' && typeof block?.thinking === 'string') {
      thinkingLength += block.thinking.length;
    }
  }

  return {
    content_block_types: Array.from(contentBlockTypes),
    tool_use_ids: Array.from(toolUseIds),
    tool_use_names: Array.from(toolUseNames),
    text_length: textLength,
    thinking_length: thinkingLength,
  };
}

function extractTokenUsageFromMessage(payload) {
  const usage = payload?.usage || {};
  return {
    model: typeof payload?.model === 'string' && payload.model.length > 0 ? payload.model : 'unknown',
    stop_reason:
      typeof payload?.stop_reason === 'string' && payload.stop_reason.length > 0
        ? payload.stop_reason
        : 'unknown',
    tokens: {
      input_tokens: Number.isFinite(usage.input_tokens) ? Math.trunc(usage.input_tokens) : 0,
      output_tokens: Number.isFinite(usage.output_tokens) ? Math.trunc(usage.output_tokens) : 0,
      cache_read_input_tokens: Number.isFinite(usage.cache_read_input_tokens)
        ? Math.trunc(usage.cache_read_input_tokens)
        : 0,
      cache_creation_input_tokens: Number.isFinite(usage.cache_creation_input_tokens)
        ? Math.trunc(usage.cache_creation_input_tokens)
        : 0,
    },
  };
}

function parseHeaderInt(headers, name) {
  const raw = headers?.get?.(name);
  if (raw == null) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function extractRateLimit(headers) {
  const requestsRemaining = parseHeaderInt(headers, 'x-ratelimit-requests-remaining');
  const requestsLimit = parseHeaderInt(headers, 'x-ratelimit-requests-limit');
  const inputTokensRemaining = parseHeaderInt(headers, 'x-ratelimit-input-tokens-remaining');
  const inputTokensLimit = parseHeaderInt(headers, 'x-ratelimit-input-tokens-limit');

  if (
    requestsRemaining === null &&
    requestsLimit === null &&
    inputTokensRemaining === null &&
    inputTokensLimit === null
  ) {
    return null;
  }

  return {
    requests_remaining: requestsRemaining ?? 0,
    requests_limit: requestsLimit ?? 0,
    input_tokens_remaining: inputTokensRemaining ?? 0,
    input_tokens_limit: inputTokensLimit ?? 0,
  };
}

function postWithOriginalFetch(originalFetch, event) {
  postLLMCallEvent(event, (url, options) => originalFetch.call(globalThis, url, options));
}

async function processSSEBranch({
  inspectorStream,
  requestBodyPromise,
  startNs,
  responseHeaders,
  originalFetch,
}) {
  try {
    const [requestBody, parsedSSE] = await Promise.all([
      requestBodyPromise,
      parseSSEStream(inspectorStream),
    ]);

    const endNs = nowHrtimeNs();
    const tokenExtraction = extractTokenUsageFromSSEEvents(parsedSSE.events);
    const requestSummary = extractRequestSummary(requestBody);
    const responseSummary = extractResponseSummary(parsedSSE.events);
    const rateLimit = extractRateLimit(responseHeaders);

    const event = buildLLMCallEvent({
      session_id: resolveSessionId(),
      model: tokenExtraction.model || requestBody?.model || 'unknown',
      stop_reason: tokenExtraction.stop_reason,
      stream: requestBody?.stream !== false,
      tokens: tokenExtraction.tokens,
      timing: {
        start_ns: startNs,
        ttfb_ms: computeTTFBMs(startNs, parsedSSE.firstChunkNs),
        duration_ms: computeDurationMs(startNs, endNs),
      },
      request_summary: requestSummary,
      response_summary: responseSummary,
      rate_limit: rateLimit,
      error: null,
    });

    postWithOriginalFetch(originalFetch, event);
  } catch {
    // Silent by design.
  }
}

async function processJSONBranch({
  response,
  requestBodyPromise,
  startNs,
  responseHeaders,
  originalFetch,
}) {
  try {
    const [requestBody, payload] = await Promise.all([
      requestBodyPromise,
      response
        .text()
        .then((text) => parseJsonSafe(text))
        .catch(() => ({})),
    ]);
    const endNs = nowHrtimeNs();
    const tokenExtraction = extractTokenUsageFromMessage(payload);
    const requestSummary = extractRequestSummary(requestBody);
    const responseSummary = extractResponseSummaryFromMessage(payload);
    const rateLimit = extractRateLimit(responseHeaders);

    const event = buildLLMCallEvent({
      session_id: resolveSessionId(),
      model: tokenExtraction.model || requestBody?.model || 'unknown',
      stop_reason: tokenExtraction.stop_reason,
      stream: false,
      tokens: tokenExtraction.tokens,
      timing: {
        start_ns: startNs,
        ttfb_ms: computeTTFBMs(startNs, endNs),
        duration_ms: computeDurationMs(startNs, endNs),
      },
      request_summary: requestSummary,
      response_summary: responseSummary,
      rate_limit: rateLimit,
      error: payload && Object.keys(payload).length > 0 ? null : 'json_parse_failed',
    });

    postWithOriginalFetch(originalFetch, event);
  } catch {
    // Silent by design.
  }
}

if (typeof globalThis.fetch === 'function' && !globalThis.fetch[INTERCEPT_GUARD]) {
  const originalFetch = globalThis.fetch;

  const patchedFetch = async function trajectoryInterceptFetch(input, init) {
    const url = getRequestURL(input);
    if (!shouldIntercept(url)) {
      return originalFetch.call(this, input, init);
    }

    const requestBodyPromise = extractRequestBody(input, init);
    const startNs = nowHrtimeNs();

    const response = await originalFetch.call(this, input, init);

    try {
      if (!response?.body || typeof response.body.tee !== 'function') {
        return response;
      }

      const [callerStream, inspectorStream] = response.body.tee();
      const forwardedResponse = new Response(callerStream, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });

      const contentType = response.headers?.get?.('content-type') || '';
      if (contentType.toLowerCase().includes('text/event-stream')) {
        void processSSEBranch({
          inspectorStream,
          requestBodyPromise,
          startNs,
          responseHeaders: response.headers,
          originalFetch,
        });
      } else {
        void processJSONBranch({
          response: new Response(inspectorStream, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          }),
          requestBodyPromise,
          startNs,
          responseHeaders: response.headers,
          originalFetch,
        });
      }

      return forwardedResponse;
    } catch {
      return response;
    }
  };

  patchedFetch[INTERCEPT_GUARD] = true;
  globalThis.fetch = patchedFetch;
}
