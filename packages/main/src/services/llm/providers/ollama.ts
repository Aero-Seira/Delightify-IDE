/**
 * Ollama Provider
 * 
 * 支持本地 Ollama 部署
 */

import { BaseLLMProvider } from './base';
import type { LLMMessage, LLMResponse, LLMRequestOptions } from '../types';

export class OllamaProvider extends BaseLLMProvider {
  private baseUrl: string;

  constructor(config: { model: string; endpoint?: string }) {
    super({
      provider: 'ollama',
      model: config.model,
      endpoint: config.endpoint || 'http://localhost:11434',
      maxTokens: 4096,
      temperature: 0.3,
      timeout: 120000, // 本地模型可能需要更长时间
    });
    this.baseUrl = config.endpoint?.replace(/\/$/, '') || 'http://localhost:11434';
  }

  async chat(messages: LLMMessage[], options?: LLMRequestOptions): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      // Ollama 使用 /api/chat 端点
      // 构建 options
      const requestOptions: Record<string, unknown> = {};
      const temperature = options?.modelConfig?.temperature ?? this.config.temperature;
      if (temperature !== undefined) {
        requestOptions.temperature = temperature;
      }
      const maxTokens = options?.modelConfig?.maxTokens ?? this.config.maxTokens;
      if (maxTokens !== undefined) {
        requestOptions.num_predict = maxTokens;
      }
      
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: options?.modelConfig?.model ?? this.config.model,
            messages,
            stream: false,
            ...(Object.keys(requestOptions).length > 0 ? { options: requestOptions } : {}),
          }),
        },
        options?.modelConfig?.timeout ?? this.config.timeout
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const content = data.message?.content || '';

      return {
        content,
        model: options?.modelConfig?.model ?? this.config.model,
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
        `${this.baseUrl}/api/tags`,
        {
          method: 'GET',
        },
        5000
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 列出本地可用的模型
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/tags`,
        {
          method: 'GET',
        },
        10000
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.models?.map((m: { name: string }) => m.name) || [];
    } catch {
      return [];
    }
  }

  /**
   * 检查模型是否已下载
   */
  async isModelAvailable(modelName?: string): Promise<boolean> {
    const models = await this.listModels();
    const targetModel = modelName ?? this.config.model;
    return models.some(m => m.startsWith(targetModel));
  }
}
