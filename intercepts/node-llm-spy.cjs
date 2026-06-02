'use strict';

(() => {
  const ANTHROPIC_HOST = 'api.anthropic.com';
  const ANTHROPIC_PATH_PATTERN = /^\/v1\/(messages|complete)(\/|$)/;
  const CAPTURE_URL = process.env.TRAJECTORY_CAPTURE_URL || 'http://127.0.0.1:19222';
  const CAPTURE_ENDPOINT = `${CAPTURE_URL}/llm-call`;
  const PATCH_SENTINEL = Symbol.for('trajectory.nodeLlmSpy.patch');

  const originalFetch = globalThis?.fetch;
  if (typeof originalFetch !== 'function') {
    return;
  }
  if (globalThis.fetch && globalThis.fetch[PATCH_SENTINEL]) {
    return;
  }

  const { TextDecoder } = require('node:util');
  const decoder = new TextDecoder();

  function toInteger(value) {
    const num = Number(value);
    return Number.isFinite(num) ? Math.max(0, Math.floor(num)) : 0;
  }

  function shouldIntercept(urlString) {
    if (!urlString) return false;
    try {
      const url = new URL(urlString);
      return url.hostname === ANTHROPIC_HOST || ANTHROPIC_PATH_PATTERN.test(url.pathname);
    } catch {
      return false;
    }
  }

  function getUrlFromFetchArgs(input) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    if (input && typeof input.url === 'string') return input.url;
    return '';
  }

  function isEventStreamResponse(response) {
    try {
      const contentType = response.headers?.get?.('content-type') || '';
      return contentType.toLowerCase().includes('text/event-stream');
    } catch {
      return false;
    }
  }

  function safeParseJSON(text) {
    if (typeof text !== 'string' || text.length === 0) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function decodeBodyBodyLike(body) {
    if (!body) return '';
    if (typeof body === 'string') return body;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) return body.toString('utf8');
    if (body instanceof Uint8Array) return decoder.decode(body);
    if (body instanceof ArrayBuffer) return decoder.decode(new Uint8Array(body));
    return '';
  }

  async function parseRequestBody(input, init) {
    try {
      if (init && Object.prototype.hasOwnProperty.call(init, 'body')) {
        return safeParseJSON(decodeBodyBodyLike(init.body));
      }

      if (input && typeof input === 'object' && typeof input.clone === 'function') {
        const cloned = input.clone();
        if (typeof cloned.text === 'function') {
          return safeParseJSON(await cloned.text());
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  function concatChunks(chunks) {
    let total = 0;
    for (const chunk of chunks) total += chunk.byteLength;
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  }

  function parseSSEEvents(chunks) {
    const text = decoder.decode(concatChunks(chunks));
    const events = [];
    let currentEvent = '';
    let dataLines = [];

    function flushEvent() {
      if (!currentEvent && dataLines.length === 0) return;
      const dataText = dataLines.join('\n');
      if (dataText && dataText !== '[DONE]') {
        const parsed = safeParseJSON(dataText);
        if (parsed) events.push({ event: currentEvent, data: parsed });
      }
      currentEvent = '';
      dataLines = [];
    }

    for (const line of text.split(/\r?\n/)) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        dataLines.push(line.slice(6));
      } else if (line.trim() === '') {
        flushEvent();
      }
    }
    flushEvent();
    return events;
  }

  function extractFromSSEEvents(events) {
    let model = '';
    let stopReason = '';
    const tokens = {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    };

    for (const entry of events) {
      const event = entry?.event;
      const data = entry?.data || {};

      if (event === 'message_start') {
        const message = data.message || {};
        const usage = message.usage || {};
        if (!model && typeof message.model === 'string') {
          model = message.model;
        }
        tokens.input_tokens = toInteger(usage.input_tokens);
        tokens.cache_read_input_tokens = toInteger(usage.cache_read_input_tokens);
        tokens.cache_creation_input_tokens = toInteger(usage.cache_creation_input_tokens);
      } else if (event === 'message_delta') {
        const usage = data.usage || {};
        if (usage.output_tokens !== undefined) {
          tokens.output_tokens = toInteger(usage.output_tokens);
        }
        const delta = data.delta || {};
        if (typeof delta.stop_reason === 'string' && delta.stop_reason.length > 0) {
          stopReason = delta.stop_reason;
        }
      } else if (event === 'message_stop') {
        if (!stopReason && typeof data.stop_reason === 'string' && data.stop_reason.length > 0) {
          stopReason = data.stop_reason;
        }
      }
    }

    return { model, stopReason, tokens };
  }

  function extractFromJSONResponse(payload) {
    const usage = payload?.usage || {};
    return {
      model: typeof payload?.model === 'string' ? payload.model : '',
      stopReason: typeof payload?.stop_reason === 'string' ? payload.stop_reason : '',
      tokens: {
        input_tokens: toInteger(usage.input_tokens),
        output_tokens: toInteger(usage.output_tokens),
        cache_read_input_tokens: toInteger(usage.cache_read_input_tokens),
        cache_creation_input_tokens: toInteger(usage.cache_creation_input_tokens),
      },
    };
  }

  function extractRequestSummary(body) {
    const request = body && typeof body === 'object' ? body : {};
    const messages = Array.isArray(request.messages) ? request.messages : [];
    const tools = Array.isArray(request.tools) ? request.tools : [];
    const toolResultIds = [];

    for (const message of messages) {
      const content = message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block?.type === 'tool_result' && typeof block?.tool_use_id === 'string') {
          toolResultIds.push(block.tool_use_id);
        }
      }
    }

    return {
      message_count: messages.length,
      system_present: Boolean(request.system),
      tools_count: tools.length,
      max_tokens: Number.isFinite(request.max_tokens) ? Math.trunc(request.max_tokens) : 0,
      has_tool_results: toolResultIds.length > 0,
      tool_result_ids: toolResultIds,
    };
  }

  function extractResponseSummaryFromJSON(payload) {
    const content = Array.isArray(payload?.content) ? payload.content : [];
    const contentBlockTypes = new Set();
    const toolUseIds = new Set();
    const toolUseNames = new Set();
    let textLength = 0;
    let thinkingLength = 0;

    for (const block of content) {
      if (typeof block?.type === 'string' && block.type.length > 0) {
        contentBlockTypes.add(block.type);
      }
      if (block?.type === 'text' && typeof block?.text === 'string') {
        textLength += block.text.length;
      }
      if (block?.type === 'thinking' && typeof block?.thinking === 'string') {
        thinkingLength += block.thinking.length;
      }
      if (block?.type === 'tool_use') {
        if (typeof block?.id === 'string' && block.id.length > 0) {
          toolUseIds.add(block.id);
        }
        if (typeof block?.name === 'string' && block.name.length > 0) {
          toolUseNames.add(block.name);
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

  function extractResponseSummaryFromSSEEvents(events) {
    const contentBlockTypes = new Set();
    const toolUseIds = new Set();
    const toolUseNames = new Set();
    let textLength = 0;
    let thinkingLength = 0;

    for (const entry of events) {
      const event = entry?.event || entry?.data?.type || '';
      const data = entry?.data || {};
      if (event === 'content_block_start') {
        const block = data.content_block || {};
        if (typeof block.type === 'string' && block.type.length > 0) {
          contentBlockTypes.add(block.type);
        }
        if (block.type === 'tool_use') {
          if (typeof block.id === 'string' && block.id.length > 0) toolUseIds.add(block.id);
          if (typeof block.name === 'string' && block.name.length > 0) toolUseNames.add(block.name);
        }
        continue;
      }
      if (event === 'content_block_delta') {
        const delta = data.delta || {};
        if (delta.type === 'text_delta') {
          contentBlockTypes.add('text');
          if (typeof delta.text === 'string') textLength += delta.text.length;
        }
        if (delta.type === 'thinking_delta') {
          contentBlockTypes.add('thinking');
          if (typeof delta.thinking === 'string') thinkingLength += delta.thinking.length;
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

  function parseHeaderInt(headers, name) {
    const raw = headers?.get?.(name);
    if (raw == null) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
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

  function buildEvent({
    sessionId,
    model,
    stopReason,
    stream,
    tokens,
    startMs,
    ttfbMs,
    durationMs,
    requestSummary,
    responseSummary,
    rateLimit,
    error,
  }) {
    const event = {
      event_type: 'llm_call',
      session_id: sessionId || '',
      timestamp: new Date().toISOString(),
      provider: 'anthropic',
      operation: 'messages',
      model: model || 'unknown',
      stop_reason: stopReason || 'unknown',
      stream: Boolean(stream),
      tokens: tokens || {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
      timing: {
        start_ns: Math.max(0, toInteger(startMs) * 1000000),
        ttfb_ms: Math.max(0, toInteger(ttfbMs)),
        duration_ms: Math.max(0, toInteger(durationMs)),
      },
      request_summary: requestSummary || {
        message_count: 0,
        system_present: false,
        tools_count: 0,
        max_tokens: 0,
        has_tool_results: false,
        tool_result_ids: [],
      },
      response_summary: responseSummary || {
        content_block_types: [],
        tool_use_ids: [],
        tool_use_names: [],
        text_length: 0,
        thinking_length: 0,
      },
      error: error || null,
    };
    if (rateLimit) {
      event.rate_limit = rateLimit;
    }
    return event;
  }

  function legacyBuildEvent(sessionId, model, stopReason, stream, tokens, startMs, ttfbMs, durationMs, error) {
    return {
      event_type: 'llm_call',
      session_id: sessionId || '',
      timestamp: new Date().toISOString(),
      model: model || '',
      stop_reason: stopReason || '',
      stream: Boolean(stream),
      tokens: tokens || {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
      timing: {
        start_ns: Math.max(0, toInteger(startMs) * 1000000),
        ttfb_ms: Math.max(0, toInteger(ttfbMs)),
        duration_ms: Math.max(0, toInteger(durationMs)),
      },
      request_summary: {
        message_count: 0,
        system_present: false,
        tools_count: 0,
        max_tokens: 0,
        has_tool_results: false,
        tool_result_ids: [],
      },
      response_summary: {
        content_block_types: [],
        tool_use_ids: [],
        tool_use_names: [],
        text_length: 0,
        thinking_length: 0,
      },
      error: error || null,
    };
  }

  function postEvent(eventPayload) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      Promise.resolve(
        originalFetch.call(globalThis, CAPTURE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventPayload),
          signal: controller.signal,
        }),
      )
        .catch(() => {})
        .finally(() => clearTimeout(timeoutId));
    } catch {
      // Never break host process.
    }
  }

  function emitFromSSE(chunks, context, ttfbMs, durationMs, error) {
    try {
      const events = parseSSEEvents(chunks);
      const extracted = extractFromSSEEvents(events);
      postEvent(
        buildEvent({
          sessionId: context.sessionId,
          model: extracted.model,
          stopReason: extracted.stopReason,
          stream: context.stream,
          tokens: extracted.tokens,
          startMs: context.startMs,
          ttfbMs,
          durationMs,
          requestSummary: extractRequestSummary(context.requestBody),
          responseSummary: extractResponseSummaryFromSSEEvents(events),
          rateLimit: extractRateLimit(context.responseHeaders),
          error,
        }),
      );
    } catch {
      postEvent(
        legacyBuildEvent(context.sessionId, '', '', context.stream, null, context.startMs, ttfbMs, durationMs, 'sse_parse_failed'),
      );
    }
  }

  async function processNonStreamingResponse(clonedResponse, context, ttfbMs) {
    try {
      const payload = safeParseJSON(await clonedResponse.text());
      const durationMs = Date.now() - context.startMs;
      const extracted = payload ? extractFromJSONResponse(payload) : { model: '', stopReason: '', tokens: null };
      postEvent(
        buildEvent({
          sessionId: context.sessionId,
          model: extracted.model,
          stopReason: extracted.stopReason,
          stream: context.stream,
          tokens: extracted.tokens,
          startMs: context.startMs,
          ttfbMs,
          durationMs,
          requestSummary: extractRequestSummary(context.requestBody),
          responseSummary: payload ? extractResponseSummaryFromJSON(payload) : null,
          rateLimit: extractRateLimit(context.responseHeaders),
          error: payload ? null : 'json_parse_failed',
        }),
      );
    } catch {
      const durationMs = Date.now() - context.startMs;
      postEvent(
        legacyBuildEvent(context.sessionId, '', '', context.stream, null, context.startMs, ttfbMs, durationMs, 'response_read_failed'),
      );
    }
  }

  function interceptStreamingResponse(response, context, headerTtfbMs) {
    if (!response.body || typeof response.body.getReader !== 'function') {
      return response;
    }

    const reader = response.body.getReader();
    const capturedChunks = [];
    let firstChunkSeen = false;
    let streamTtfbMs = headerTtfbMs;

    const teedStream = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            const durationMs = Date.now() - context.startMs;
            emitFromSSE(capturedChunks, context, streamTtfbMs, durationMs, null);
            return;
          }

          if (value instanceof Uint8Array) {
            capturedChunks.push(value);
          } else if (value) {
            capturedChunks.push(new Uint8Array(value));
          }

          if (!firstChunkSeen) {
            firstChunkSeen = true;
            const firstChunkTtfb = Date.now() - context.startMs;
            streamTtfbMs = headerTtfbMs > 0 ? Math.min(headerTtfbMs, firstChunkTtfb) : firstChunkTtfb;
          }
          controller.enqueue(value);
        } catch (err) {
          try {
            controller.error(err);
          } catch {
            // ignore
          }
          const durationMs = Date.now() - context.startMs;
          emitFromSSE(capturedChunks, context, streamTtfbMs, durationMs, 'stream_read_failed');
        }
      },
      cancel(reason) {
        try {
          return reader.cancel(reason);
        } catch {
          return undefined;
        }
      },
    });

    return new Response(teedStream, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  async function patchedFetch(input, init) {
    const url = getUrlFromFetchArgs(input);
    if (!shouldIntercept(url)) {
      return originalFetch.call(this, input, init);
    }

    const startMs = Date.now();
    const sessionId = process.env.TRAJECTORY_SESSION_ID || '';
    const requestBody = await parseRequestBody(input, init);
    const requestStream = typeof requestBody?.stream === 'boolean' ? requestBody.stream : undefined;

    let response;
    try {
      response = await originalFetch.call(this, input, init);
    } catch (err) {
      throw err;
    }

    if (!response || response.status !== 200) {
      return response;
    }

    const headerTtfbMs = Date.now() - startMs;
    const context = {
      startMs,
      stream: requestStream !== undefined ? requestStream : isEventStreamResponse(response),
      sessionId,
      requestBody,
      responseHeaders: response.headers,
    };

    try {
      if (context.stream) {
        return interceptStreamingResponse(response, context, headerTtfbMs);
      }
      void processNonStreamingResponse(response.clone(), context, headerTtfbMs);
      return response;
    } catch {
      return response;
    }
  }

  try {
    Object.defineProperty(patchedFetch, PATCH_SENTINEL, {
      value: true,
      enumerable: false,
      writable: false,
    });
  } catch {
    // ignore
  }

  globalThis.fetch = patchedFetch;
})();
