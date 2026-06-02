const DEFAULT_CAPTURE_URL = 'http://127.0.0.1:19222';
const SESSION_ID_ENV_VAR = 'TRAJECTORY_SESSION_ID';
const POST_TIMEOUT_MS = 2000;

export function resolveCaptureURL() {
  try {
    const configured = process?.env?.TRAJECTORY_CAPTURE_URL;
    if (typeof configured === 'string' && configured.trim().length > 0) {
      return configured.trim().replace(/\/+$/, '');
    }
  } catch {
    // Silent by design.
  }
  return DEFAULT_CAPTURE_URL;
}

export function resolveLLMCallEndpoint() {
  return `${resolveCaptureURL()}/llm-call`;
}

function toInteger(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.trunc(num);
}

function toSafeNumberFromBigInt(value, fallback = 0) {
  if (typeof value !== 'bigint') {
    return toInteger(value, fallback);
  }

  const max = BigInt(Number.MAX_SAFE_INTEGER);
  const min = BigInt(Number.MIN_SAFE_INTEGER);
  if (value > max) {
    return Number.MAX_SAFE_INTEGER;
  }
  if (value < min) {
    return Number.MIN_SAFE_INTEGER;
  }
  return Number(value);
}

function normalizeArray(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((value) => (typeof value === 'string' ? value : String(value ?? '')))
    .filter((value) => value.length > 0);
}

function normalizeTokenObject(tokens) {
  return {
    input_tokens: toInteger(tokens?.input_tokens, 0),
    output_tokens: toInteger(tokens?.output_tokens, 0),
    cache_read_input_tokens: toInteger(tokens?.cache_read_input_tokens, 0),
    cache_creation_input_tokens: toInteger(tokens?.cache_creation_input_tokens, 0),
  };
}

function normalizeRequestSummary(summary) {
  const toolResultIds = normalizeArray(summary?.tool_result_ids);
  return {
    message_count: toInteger(summary?.message_count, 0),
    system_present: Boolean(summary?.system_present),
    tools_count: toInteger(summary?.tools_count, 0),
    max_tokens: toInteger(summary?.max_tokens, 0),
    has_tool_results: Boolean(summary?.has_tool_results) || toolResultIds.length > 0,
    tool_result_ids: toolResultIds,
  };
}

function normalizeResponseSummary(summary) {
  return {
    content_block_types: normalizeArray(summary?.content_block_types),
    tool_use_ids: normalizeArray(summary?.tool_use_ids),
    tool_use_names: normalizeArray(summary?.tool_use_names),
    text_length: toInteger(summary?.text_length, 0),
    thinking_length: toInteger(summary?.thinking_length, 0),
  };
}

function parseSSEBlock(eventName, dataLines) {
  if (!dataLines.length) {
    return null;
  }

  const rawData = dataLines.join('\n');
  if (rawData.trim() === '[DONE]') {
    return { done: true };
  }

  try {
    const parsed = JSON.parse(rawData);
    return {
      event: eventName || parsed?.type || '',
      data: parsed,
      done: false,
    };
  } catch {
    return null;
  }
}

function takeUsageNumber(usage, key) {
  const value = usage?.[key];
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.trunc(value));
}

function mergeUsage(tokens, usage) {
  const keys = [
    'input_tokens',
    'output_tokens',
    'cache_read_input_tokens',
    'cache_creation_input_tokens',
  ];

  for (const key of keys) {
    const value = takeUsageNumber(usage, key);
    if (value === null) {
      continue;
    }
    tokens[key] = Math.max(tokens[key] ?? 0, value);
  }
}

function normalizeOptionalObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return null;
  }
  return obj;
}

export function hrtimeToNs(value) {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.max(0, Math.trunc(value)));
  }

  if (Array.isArray(value) && value.length === 2) {
    const seconds = toInteger(value[0], 0);
    const nanos = toInteger(value[1], 0);
    return BigInt(seconds) * 1_000_000_000n + BigInt(nanos);
  }

  return 0n;
}

export function nowHrtimeNs() {
  try {
    if (typeof process !== 'undefined' && process?.hrtime?.bigint) {
      return process.hrtime.bigint();
    }
    if (typeof Bun !== 'undefined' && typeof Bun.nanoseconds === 'function') {
      return hrtimeToNs(Bun.nanoseconds());
    }
  } catch {
    // Silent by design.
  }

  return BigInt(Date.now()) * 1_000_000n;
}

export function computeTTFBMs(startNs, firstChunkNs) {
  const start = hrtimeToNs(startNs);
  const first = hrtimeToNs(firstChunkNs);
  if (first <= 0n || first < start) {
    return 0;
  }
  return toSafeNumberFromBigInt((first - start) / 1_000_000n, 0);
}

export function computeDurationMs(startNs, endNs = nowHrtimeNs()) {
  const start = hrtimeToNs(startNs);
  const end = hrtimeToNs(endNs);
  if (end <= 0n || end < start) {
    return 0;
  }
  return toSafeNumberFromBigInt((end - start) / 1_000_000n, 0);
}

export function resolveSessionId() {
  try {
    const sessionId = process?.env?.[SESSION_ID_ENV_VAR];
    if (typeof sessionId === 'string' && sessionId.length > 0) {
      return sessionId;
    }
  } catch {
    // Silent by design.
  }
  return 'unknown';
}

export async function parseSSEStream(stream) {
  const events = [];
  let sawDone = false;
  let firstChunkNs = null;

  if (!stream || typeof stream.getReader !== 'function') {
    return { events, firstChunkNs, sawDone };
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';
  let dataLines = [];

  const flush = () => {
    const parsed = parseSSEBlock(currentEvent, dataLines);
    currentEvent = '';
    dataLines = [];

    if (!parsed) {
      return;
    }
    if (parsed.done) {
      sawDone = true;
      return;
    }

    events.push(parsed);
  };

  const consumeLine = (line) => {
    if (line === '') {
      flush();
      return;
    }

    if (line.startsWith(':')) {
      return;
    }

    const separator = line.indexOf(':');
    let field = line;
    let value = '';

    if (separator >= 0) {
      field = line.slice(0, separator);
      value = line.slice(separator + 1);
      if (value.startsWith(' ')) {
        value = value.slice(1);
      }
    }

    if (field === 'event') {
      currentEvent = value;
      return;
    }

    if (field === 'data') {
      dataLines.push(value);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (firstChunkNs === null && value && value.byteLength > 0) {
        firstChunkNs = nowHrtimeNs();
      }

      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        consumeLine(line);
      }
    }

    buffer += decoder.decode();
    buffer = buffer.replace(/\r\n/g, '\n');
    if (buffer.length > 0) {
      consumeLine(buffer);
    }
    flush();
  } catch {
    // Silent by design.
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Silent by design.
    }
  }

  return { events, firstChunkNs, sawDone };
}

export function extractTokenUsageFromSSEEvents(events) {
  const tokens = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  };

  let model = 'unknown';
  let stopReason = 'unknown';

  for (const event of Array.isArray(events) ? events : []) {
    const eventType = event?.event || event?.data?.type || '';
    const data = event?.data;

    if (eventType === 'message_start') {
      const message = data?.message;
      if (typeof message?.model === 'string' && message.model.length > 0) {
        model = message.model;
      }
      mergeUsage(tokens, message?.usage);
      if (typeof message?.stop_reason === 'string' && message.stop_reason.length > 0) {
        stopReason = message.stop_reason;
      }
      continue;
    }

    if (eventType === 'message_delta') {
      mergeUsage(tokens, data?.usage);
      const deltaStopReason = data?.delta?.stop_reason;
      if (typeof deltaStopReason === 'string' && deltaStopReason.length > 0) {
        stopReason = deltaStopReason;
      }
      continue;
    }

    if (eventType === 'message_stop') {
      const stop = data?.stop_reason;
      if (typeof stop === 'string' && stop.length > 0) {
        stopReason = stop;
      }
    }
  }

  return {
    model,
    stop_reason: stopReason,
    tokens: normalizeTokenObject(tokens),
  };
}

export function buildLLMCallEvent(fields = {}) {
  const timingStartNs = fields?.timing?.start_ns;
  const event = {
    event_type: 'llm_call',
    session_id: fields?.session_id || resolveSessionId(),
    timestamp: typeof fields?.timestamp === 'string' ? fields.timestamp : new Date().toISOString(),
    model: typeof fields?.model === 'string' && fields.model.length > 0 ? fields.model : 'unknown',
    stop_reason:
      typeof fields?.stop_reason === 'string' && fields.stop_reason.length > 0
        ? fields.stop_reason
        : 'unknown',
    stream: fields?.stream !== false,
    tokens: normalizeTokenObject(fields?.tokens),
    timing: {
      start_ns: toSafeNumberFromBigInt(hrtimeToNs(timingStartNs), 0),
      ttfb_ms: toInteger(fields?.timing?.ttfb_ms, 0),
      duration_ms: toInteger(fields?.timing?.duration_ms, 0),
    },
    request_summary: normalizeRequestSummary(fields?.request_summary),
    response_summary: normalizeResponseSummary(fields?.response_summary),
    error: fields?.error == null ? null : String(fields.error),
  };

  const contextBreakdown = normalizeOptionalObject(fields?.context_breakdown);
  if (contextBreakdown) {
    event.context_breakdown = contextBreakdown;
  }

  const costNanodollars = normalizeOptionalObject(fields?.cost_nanodollars);
  if (costNanodollars) {
    event.cost_nanodollars = costNanodollars;
  }

  const rateLimit = normalizeOptionalObject(fields?.rate_limit);
  if (rateLimit) {
    event.rate_limit = rateLimit;
  }

  return event;
}

export function postLLMCallEvent(event, fetchImpl = globalThis.fetch) {
  try {
    if (typeof fetchImpl !== 'function') {
      return;
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => {
          try {
            controller.abort();
          } catch {
            // Silent by design.
          }
        }, POST_TIMEOUT_MS)
      : null;

    Promise.resolve(
      fetchImpl(resolveLLMCallEndpoint(), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(event),
        signal: controller?.signal,
      })
    )
      .catch(() => {
        // Silent by design.
      })
      .finally(() => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      });
  } catch {
    // Silent by design.
  }
}

const LLM_CALL_ENDPOINT = resolveLLMCallEndpoint();
export { LLM_CALL_ENDPOINT };
