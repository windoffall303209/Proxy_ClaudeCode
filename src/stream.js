import { randomUUID } from 'node:crypto';

import { ProxyError, createMessageId, estimateTokenCount, mapOpenAiFinishReason } from './anthropic.js';

function writeEvent(response, eventName, payload) {
  response.write(`event: ${eventName}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function writeStreamingError(response, error) {
  writeEvent(response, 'error', {
    type: 'error',
    error: {
      type: error.type || 'api_error',
      message: error.message || 'Streaming proxy failed.'
    }
  });
}

function extractTextDelta(content) {
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

async function* iterateSseData(stream) {
  if (!stream) {
    throw new ProxyError(502, 'api_error', 'Upstream NIM stream body was empty.');
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    buffer = buffer.replace(/\r\n/gu, '\n');

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const dataLines = rawEvent
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart());

      if (dataLines.length > 0) {
        yield dataLines.join('\n');
      }

      boundary = buffer.indexOf('\n\n');
    }

    if (done) {
      break;
    }
  }

  const trailingEvent = buffer.trim();
  if (!trailingEvent) {
    return;
  }

  const dataLines = trailingEvent
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length > 0) {
    yield dataLines.join('\n');
  }
}

export async function pipeOpenAiStreamAsAnthropic(upstreamResponse, response, context) {
  const messageId = context.messageId || createMessageId();
  let finishReason = null;
  let upstreamUsage = null;
  let nextContentIndex = 0;
  let activeTextBlockIndex = null;
  let outputAccumulator = '';
  let toolAccumulator = '';
  const toolBlocks = new Map();

  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
    'request-id': context.requestId
  });
  response.flushHeaders?.();

  writeEvent(response, 'message_start', {
    type: 'message_start',
    message: {
      id: messageId,
      type: 'message',
      role: 'assistant',
      model: context.facadeModel,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: context.estimatedInputTokens ?? 0,
        output_tokens: 0
      }
    }
  });

  try {
    for await (const data of iterateSseData(upstreamResponse.body)) {
      if (data === '[DONE]') {
        break;
      }

      const chunk = JSON.parse(data);
      if (chunk?.usage) {
        upstreamUsage = chunk.usage;
      }

      const choice = chunk?.choices?.[0];
      if (!choice) {
        continue;
      }

      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }

      const delta = choice.delta || {};
      const textDelta = extractTextDelta(delta.content);
      if (textDelta) {
        if (activeTextBlockIndex === null) {
          activeTextBlockIndex = nextContentIndex;
          nextContentIndex += 1;
          writeEvent(response, 'content_block_start', {
            type: 'content_block_start',
            index: activeTextBlockIndex,
            content_block: {
              type: 'text',
              text: ''
            }
          });
        }

        writeEvent(response, 'content_block_delta', {
          type: 'content_block_delta',
          index: activeTextBlockIndex,
          delta: {
            type: 'text_delta',
            text: textDelta
          }
        });
        outputAccumulator += textDelta;
      }

      if (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0) {
        if (activeTextBlockIndex !== null) {
          writeEvent(response, 'content_block_stop', {
            type: 'content_block_stop',
            index: activeTextBlockIndex
          });
          activeTextBlockIndex = null;
        }

        for (const toolCall of delta.tool_calls) {
          const key = Number.isInteger(toolCall.index) ? toolCall.index : toolBlocks.size;
          let block = toolBlocks.get(key);

          if (!block) {
            block = {
              id: toolCall.id || `toolu_${randomUUID().replace(/-/gu, '')}`,
              name: '',
              contentIndex: null,
              pendingArgs: '',
              started: false
            };
            toolBlocks.set(key, block);
          }

          if (toolCall.id) {
            block.id = toolCall.id;
          }

          if (typeof toolCall?.function?.name === 'string' && toolCall.function.name) {
            block.name = toolCall.function.name;
          }

          if (typeof toolCall?.function?.arguments === 'string') {
            block.pendingArgs += toolCall.function.arguments;
          }

          if (!block.started && block.name) {
            block.contentIndex = nextContentIndex;
            nextContentIndex += 1;
            block.started = true;

            writeEvent(response, 'content_block_start', {
              type: 'content_block_start',
              index: block.contentIndex,
              content_block: {
                type: 'tool_use',
                id: block.id,
                name: block.name,
                input: {}
              }
            });
          }

          if (block.started && block.pendingArgs) {
            writeEvent(response, 'content_block_delta', {
              type: 'content_block_delta',
              index: block.contentIndex,
              delta: {
                type: 'input_json_delta',
                partial_json: block.pendingArgs
              }
            });
            toolAccumulator += block.pendingArgs;
            block.pendingArgs = '';
          }
        }
      }
    }

    if (activeTextBlockIndex !== null) {
      writeEvent(response, 'content_block_stop', {
        type: 'content_block_stop',
        index: activeTextBlockIndex
      });
    }

    for (const block of toolBlocks.values()) {
      if (!block.started) {
        continue;
      }

      if (block.pendingArgs) {
        writeEvent(response, 'content_block_delta', {
          type: 'content_block_delta',
          index: block.contentIndex,
          delta: {
            type: 'input_json_delta',
            partial_json: block.pendingArgs
          }
        });
        toolAccumulator += block.pendingArgs;
        block.pendingArgs = '';
      }

      writeEvent(response, 'content_block_stop', {
        type: 'content_block_stop',
        index: block.contentIndex
      });
    }

    writeEvent(response, 'message_delta', {
      type: 'message_delta',
      delta: {
        stop_reason: mapOpenAiFinishReason(finishReason, toolBlocks.size > 0),
        stop_sequence: null
      },
      usage: {
        output_tokens:
          upstreamUsage?.completion_tokens ?? estimateTokenCount(`${outputAccumulator}${toolAccumulator}`)
      }
    });
    writeEvent(response, 'message_stop', {
      type: 'message_stop'
    });
    response.end();
  } catch (error) {
    writeStreamingError(response, error);
    response.end();
  }
}
