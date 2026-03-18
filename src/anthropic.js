import { randomUUID } from 'node:crypto';

export class ProxyError extends Error {
  constructor(status, type, message) {
    super(message);
    this.name = 'ProxyError';
    this.status = status;
    this.type = type;
  }
}

export function createMessageId() {
  return `msg_${randomUUID().replace(/-/gu, '')}`;
}

export function invalidRequest(message) {
  return new ProxyError(400, 'invalid_request_error', message);
}

export function mapStatusToAnthropicErrorType(status) {
  switch (status) {
    case 400:
      return 'invalid_request_error';
    case 401:
      return 'authentication_error';
    case 403:
      return 'permission_error';
    case 404:
      return 'not_found_error';
    case 429:
      return 'rate_limit_error';
    case 529:
      return 'overloaded_error';
    default:
      return 'api_error';
  }
}

export function estimateTokenCount(value) {
  const text =
    typeof value === 'string'
      ? value
      : JSON.stringify(value ?? '');

  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateAnthropicInputTokens(body) {
  return estimateTokenCount({
    system: body?.system ?? null,
    messages: body?.messages ?? [],
    tools: body?.tools ?? []
  });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeContentBlocks(content, fieldName) {
  if (content === undefined || content === null) {
    return [];
  }

  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  if (Array.isArray(content)) {
    return content;
  }

  throw invalidRequest(`${fieldName} must be a string or an array of content blocks.`);
}

function extractTextFromBlocks(content, fieldName) {
  const blocks = normalizeContentBlocks(content, fieldName);
  const parts = [];

  for (const block of blocks) {
    if (block?.type === 'text' && typeof block.text === 'string') {
      parts.push(block.text);
      continue;
    }

    throw invalidRequest(`Unsupported ${fieldName} block type: ${block?.type ?? 'unknown'}.`);
  }

  return parts.join('\n');
}

function parseToolResultContent(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return extractTextFromBlocks(content, 'tool_result.content');
  }

  if (content === undefined || content === null) {
    return '';
  }

  throw invalidRequest('tool_result.content must be a string or text blocks.');
}

function anthropicToolToOpenAi(tool) {
  if (!tool?.name || !isPlainObject(tool.input_schema)) {
    throw invalidRequest('Each tool must include name and input_schema.');
  }

  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.input_schema
    }
  };
}

function anthropicToolChoiceToOpenAi(toolChoice) {
  if (!toolChoice) {
    return undefined;
  }

  switch (toolChoice.type) {
    case 'auto':
      return 'auto';
    case 'any':
      return 'required';
    case 'none':
      return 'none';
    case 'tool':
      if (!toolChoice.name) {
        throw invalidRequest('tool_choice.type "tool" requires a name.');
      }

      return {
        type: 'function',
        function: {
          name: toolChoice.name
        }
      };
    default:
      throw invalidRequest(`Unsupported tool_choice.type: ${toolChoice.type}`);
  }
}

function convertUserMessage(message) {
  const blocks = normalizeContentBlocks(message.content, 'messages.content');
  const openAiMessages = [];
  const textParts = [];

  const flushText = () => {
    if (textParts.length === 0) {
      return;
    }

    openAiMessages.push({
      role: 'user',
      content: textParts.join('\n')
    });

    textParts.length = 0;
  };

  for (const block of blocks) {
    if (block?.type === 'text' && typeof block.text === 'string') {
      textParts.push(block.text);
      continue;
    }

    if (block?.type === 'tool_result') {
      if (!block.tool_use_id) {
        throw invalidRequest('tool_result blocks require tool_use_id.');
      }

      flushText();
      openAiMessages.push({
        role: 'tool',
        tool_call_id: block.tool_use_id,
        content: parseToolResultContent(block.content)
      });
      continue;
    }

    throw invalidRequest(`Unsupported user content block type: ${block?.type ?? 'unknown'}.`);
  }

  flushText();

  if (openAiMessages.length === 0) {
    openAiMessages.push({
      role: 'user',
      content: ''
    });
  }

  return openAiMessages;
}

function convertAssistantMessage(message) {
  const blocks = normalizeContentBlocks(message.content, 'messages.content');
  const textParts = [];
  const toolCalls = [];

  for (const block of blocks) {
    if (block?.type === 'text' && typeof block.text === 'string') {
      textParts.push(block.text);
      continue;
    }

    if (block?.type === 'tool_use') {
      if (!block.name) {
        throw invalidRequest('tool_use blocks require name.');
      }

      toolCalls.push({
        id: block.id || `toolu_${randomUUID().replace(/-/gu, '')}`,
        type: 'function',
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input ?? {})
        }
      });
      continue;
    }

    throw invalidRequest(`Unsupported assistant content block type: ${block?.type ?? 'unknown'}.`);
  }

  const openAiMessage = {
    role: 'assistant'
  };

  if (textParts.length > 0) {
    openAiMessage.content = textParts.join('\n');
  }

  if (toolCalls.length > 0) {
    openAiMessage.tool_calls = toolCalls;
  }

  if (!('content' in openAiMessage) && !('tool_calls' in openAiMessage)) {
    openAiMessage.content = '';
  }

  return openAiMessage;
}

function buildOpenAiMessages(body) {
  if (!Array.isArray(body.messages)) {
    throw invalidRequest('messages must be an array.');
  }

  const messages = [];
  const systemPrompt = extractTextFromBlocks(body.system, 'system');
  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: systemPrompt
    });
  }

  for (const message of body.messages) {
    if (!message || typeof message !== 'object') {
      throw invalidRequest('Each message must be an object.');
    }

    switch (message.role) {
      case 'user':
        messages.push(...convertUserMessage(message));
        break;
      case 'assistant':
        messages.push(convertAssistantMessage(message));
        break;
      default:
        throw invalidRequest(`Unsupported message role: ${message.role}`);
    }
  }

  return messages;
}

function extractOpenAiText(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((part) => {
      if (typeof part === 'string') {
        return part;
      }

      if (part?.type === 'text' && typeof part.text === 'string') {
        return part.text;
      }

      if (part?.text?.value && typeof part.text.value === 'string') {
        return part.text.value;
      }

      return '';
    })
    .join('');
}

function parseToolArguments(rawArguments, toolName) {
  if (!rawArguments) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawArguments);
    if (isPlainObject(parsed)) {
      return parsed;
    }

    return { value: parsed };
  } catch {
    throw new ProxyError(
      502,
      'api_error',
      `Upstream tool "${toolName}" returned invalid JSON arguments.`
    );
  }
}

export function anthropicRequestToOpenAi(body, config) {
  const openAiRequest = {
    model: config.nimModel,
    messages: buildOpenAiMessages(body),
    stream: Boolean(body.stream)
  };

  if (Number.isFinite(body.max_tokens)) {
    openAiRequest.max_tokens = body.max_tokens;
  }

  if (Number.isFinite(body.temperature)) {
    openAiRequest.temperature = body.temperature;
  }

  if (Number.isFinite(body.top_p)) {
    openAiRequest.top_p = body.top_p;
  }

  if (Array.isArray(body.stop_sequences) && body.stop_sequences.length > 0) {
    openAiRequest.stop = body.stop_sequences;
  }

  if (Array.isArray(body.tools) && body.tools.length > 0) {
    openAiRequest.tools = body.tools.map(anthropicToolToOpenAi);
  }

  const toolChoice = anthropicToolChoiceToOpenAi(body.tool_choice);
  if (toolChoice !== undefined) {
    openAiRequest.tool_choice = toolChoice;
  }

  return openAiRequest;
}

export function mapOpenAiFinishReason(finishReason, hasToolUse = false) {
  switch (finishReason) {
    case 'length':
      return 'max_tokens';
    case 'tool_calls':
      return 'tool_use';
    case 'stop':
    case null:
    case undefined:
      return hasToolUse ? 'tool_use' : 'end_turn';
    default:
      return 'end_turn';
  }
}

function toFiniteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export function openAiResponseToAnthropic(payload, context) {
  const choice = payload?.choices?.[0];
  const message = choice?.message;

  if (!message) {
    throw new ProxyError(502, 'api_error', 'Upstream NIM response did not include choices[0].message.');
  }

  const content = [];
  const text = extractOpenAiText(message.content);
  if (text) {
    content.push({
      type: 'text',
      text
    });
  }

  for (const toolCall of message.tool_calls ?? []) {
    const toolName = toolCall?.function?.name || 'unknown_tool';
    content.push({
      type: 'tool_use',
      id: toolCall.id || `toolu_${randomUUID().replace(/-/gu, '')}`,
      name: toolName,
      input: parseToolArguments(toolCall?.function?.arguments, toolName)
    });
  }

  if (content.length === 0) {
    content.push({
      type: 'text',
      text: ''
    });
  }

  const hasToolUse = content.some((block) => block.type === 'tool_use');

  return {
    id: context.messageId || createMessageId(),
    type: 'message',
    role: 'assistant',
    model: context.facadeModel,
    content,
    stop_reason: mapOpenAiFinishReason(choice.finish_reason, hasToolUse),
    stop_sequence: null,
    usage: {
      input_tokens: toFiniteNumber(payload?.usage?.prompt_tokens, context.estimatedInputTokens ?? 0),
      output_tokens: toFiniteNumber(payload?.usage?.completion_tokens, estimateTokenCount(content))
    }
  };
}
