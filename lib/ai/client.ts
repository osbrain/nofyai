// ========================================
// AI API Client
// ========================================

import type { AIConfig } from './types';

/**
 * Call AI model API
 * @param systemPrompt - System prompt (trading strategy and rules)
 * @param userPrompt - User prompt (current market data and context)
 * @param config - AI API configuration
 * @returns AI response string
 */
export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  config: AIConfig
): Promise<string> {
  const baseURL =
    config.baseURL ||
    (config.model === 'deepseek'
      ? 'https://api.deepseek.com'
      : config.model === 'qwen'
        ? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
        : config.baseURL);

  if (!baseURL) {
    throw new Error('AI base URL is required for custom model');
  }

  const response = await fetch(`${baseURL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model === 'deepseek' ? 'deepseek-chat' : 'qwen-plus',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
