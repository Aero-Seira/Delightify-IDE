/**
 * OpenAI Provider
 * 
 * 支持 OpenAI API 和兼容 OpenAI 格式的其他服务
 */

import { BaseLLMProvider } from './base';
import type { LLMMessage, LLMResponse, LLMRequestOptions } from '../types';

export class OpenAIProvider extends BaseLLMProvider {
  private baseUrl: string;

  constructor(config: { apiKey: string; model: string; baseUrl?: string; temperature?: number }) {
    super({
      provider: 'openai',
      model: config.model,
      apiKey: config.apiKey,
      maxTokens: 4096,
      temperature: config.temperature, // 可能为 undefined
      timeout: 600000,
    });
    this.baseUrl = config.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1';
  }

  async chat(messages: LLMMessage[], options?: LLMRequestOptions): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(this.buildRequestBody(messages, options)),
        },
        options?.modelConfig?.timeout ?? this.config.timeout
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        content,
        model: data.model,
        usage: data.usage ? {
          prompt: data.usage.prompt_tokens,
          completion: data.usage.completion_tokens,
          total: data.usage.total_tokens,
        } : undefined,
        responseTime: Date.now() - startTime,
        success: true,
      };
    } catch (error) {
      return {
        content: '',
        model: this.config.model,
        responseTime: Date.now() - startTime,
        success: false,
        error: this.parseError(error),
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/models`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
        },
        10000
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  protected buildRequestBody(messages: LLMMessage[], options?: LLMRequestOptions): unknown {
    const body: Record<string, unknown> = {
      model: options?.modelConfig?.model ?? this.config.model,
      messages,
    };
    
    // 只在指定时添加 max_tokens
    const maxTokens = options?.modelConfig?.maxTokens ?? this.config.maxTokens;
    if (maxTokens !== undefined && maxTokens > 0) {
      body.max_tokens = maxTokens;
    }
    
    // 只在指定时添加 temperature（某些模型如 Kimi 不支持 temperature）
    const temperature = options?.modelConfig?.temperature ?? this.config.temperature;
    if (temperature !== undefined) {
      body.temperature = temperature;
    }
    
    // 只在需要时添加 response_format
    if (options?.stream !== true) {
      body.response_format = { type: 'json_object' };
    }
    
    return body;
  }
}
