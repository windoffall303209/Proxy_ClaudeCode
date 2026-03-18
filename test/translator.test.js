import test from 'node:test';
import assert from 'node:assert/strict';

import {
  anthropicRequestToOpenAi,
  estimateAnthropicInputTokens,
  openAiResponseToAnthropic
} from '../src/anthropic.js';

const config = {
  nimModel: 'meta/llama-3.1-70b-instruct'
};

test('anthropicRequestToOpenAi converts text, tools, and tool results', () => {
  const payload = anthropicRequestToOpenAi(
    {
      model: 'claude-sonnet-4-5',
      system: 'You are a coding assistant.',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Open the project.' }]
        },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'I will inspect it.' },
            {
              type: 'tool_use',
              id: 'toolu_123',
              name: 'run_command',
              input: { command: 'dir' }
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_123',
              content: 'package.json'
            }
          ]
        }
      ],
      tools: [
        {
          name: 'run_command',
          description: 'Run a shell command',
          input_schema: {
            type: 'object',
            properties: {
              command: { type: 'string' }
            },
            required: ['command']
          }
        }
      ],
      tool_choice: { type: 'tool', name: 'run_command' },
      max_tokens: 512
    },
    config
  );

  assert.equal(payload.model, config.nimModel);
  assert.equal(payload.messages[0].role, 'system');
  assert.equal(payload.messages[1].role, 'user');
  assert.equal(payload.messages[2].role, 'assistant');
  assert.equal(payload.messages[2].tool_calls[0].function.name, 'run_command');
  assert.equal(payload.messages[3].role, 'tool');
  assert.equal(payload.messages[3].tool_call_id, 'toolu_123');
  assert.equal(payload.tools[0].function.name, 'run_command');
  assert.deepEqual(payload.tool_choice, {
    type: 'function',
    function: { name: 'run_command' }
  });
});

test('openAiResponseToAnthropic converts tool calls back into Anthropic blocks', () => {
  const payload = openAiResponseToAnthropic(
    {
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            role: 'assistant',
            content: 'I need to run a command.',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'run_command',
                  arguments: '{"command":"dir"}'
                }
              }
            ]
          }
        }
      ],
      usage: {
        prompt_tokens: 120,
        completion_tokens: 32
      }
    },
    {
      facadeModel: 'claude-sonnet-4-5',
      estimatedInputTokens: 99,
      messageId: 'msg_test'
    }
  );

  assert.equal(payload.id, 'msg_test');
  assert.equal(payload.model, 'claude-sonnet-4-5');
  assert.equal(payload.stop_reason, 'tool_use');
  assert.equal(payload.content[0].type, 'text');
  assert.equal(payload.content[1].type, 'tool_use');
  assert.deepEqual(payload.content[1].input, { command: 'dir' });
  assert.deepEqual(payload.usage, {
    input_tokens: 120,
    output_tokens: 32
  });
});

test('estimateAnthropicInputTokens returns a positive heuristic count', () => {
  const count = estimateAnthropicInputTokens({
    system: 'You are useful.',
    messages: [
      {
        role: 'user',
        content: 'Hello'
      }
    ]
  });

  assert.ok(count > 0);
});
