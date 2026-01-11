// statsService.ts
import type { CanvasData } from '../hooks/useWebSocket';

export interface MetricsData {
  shapesCount: number;
  toolsUsage: Record<string, number>;
  lastUpdated: string;
  sessionDuration?: number;
  boardId: string;
  widgetId: number | null;
}

export interface WidgetConfig {
  shapes: any[];
  config: any;
  lastModified: string;
  version: string;
}

class StatsService {
  private baseURL = 'https://statservice.example.com';
  private moduleToken: string | null = null;
  private rateLimitCache = new Map<string, { count: number; resetTime: number }>();
  private readonly RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 60 minutes
  private readonly MAX_REQUESTS = 12;

  constructor() {
    this.loadToken();
  }

  private loadToken() {
    const savedToken = localStorage.getItem('moduleToken');
    if (savedToken) {
      this.moduleToken = savedToken;
    }
  }

  private saveToken(token: string) {
    this.moduleToken = token;
    localStorage.setItem('moduleToken', token);
  }

  async createModule(moduleName: string): Promise<{
    moduleId: number;
    moduleName: string;
    token: string;
    tokenExpired: string;
  }> {
    try {
      const response = await fetch(`${this.baseURL}/api/stats/module/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ moduleName })
      });

      if (!response.ok) {
        throw new Error(`Failed to create module: ${response.statusText}`);
      }

      const data = await response.json();
      this.saveToken(data.token);
      return data;
    } catch (error) {
      console.error('Error creating module:', error);
      throw error;
    }
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    const moduleKey = this.moduleToken || 'anonymous';

    const limitInfo = this.rateLimitCache.get(moduleKey);
    
    if (!limitInfo) {
      this.rateLimitCache.set(moduleKey, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW
      });
      return true;
    }

    if (now > limitInfo.resetTime) {
      this.rateLimitCache.set(moduleKey, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW
      });
      return true;
    }

    if (limitInfo.count >= this.MAX_REQUESTS) {
      return false;
    }

    limitInfo.count++;
    return true;
  }

  async sendMetrics(metrics: MetricsData): Promise<{ moduleId: number; metricId: number }> {
    if (!this.moduleToken) {
      throw new Error('Module token not set. Please create module first.');
    }

    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      const response = await fetch(`${this.baseURL}/api/stats/module/metrics`, {
        method: 'PUT',
        headers: {
          'X-Module-Token': this.moduleToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metrics)
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
      }

      if (!response.ok) {
        throw new Error(`Failed to send metrics: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending metrics:', error);
      throw error;
    }
  }

  async getMetrics(): Promise<any> {
    if (!this.moduleToken) {
      throw new Error('Module token not set');
    }

    try {
      const response = await fetch(`${this.baseURL}/api/stats/module/metrics`, {
        method: 'GET',
        headers: {
          'X-Module-Token': this.moduleToken,
        }
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to get metrics: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting metrics:', error);
      throw error;
    }
  }
}

export const statsService = new StatsService();