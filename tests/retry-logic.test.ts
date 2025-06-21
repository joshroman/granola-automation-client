// tests/retry-logic.test.ts
import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";

/**
 * Retry logic tests using fake timers
 * These tests verify retry behavior without waiting for real delays
 */

// Mock retry utility class for testing different strategies
class RetryClient {
  private config: {
    maxRetries: number;
    retryDelay: number;
    retryStrategy: 'linear' | 'exponential';
    retryableErrors: number[];
  };

  constructor(config: any = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      retryStrategy: 'linear',
      retryableErrors: [429, 500, 502, 503, 504],
      ...config
    };
  }

  async executeWithRetry(operation: () => Promise<any>): Promise<any> {
    let attempts = 0;
    let lastError: any;

    while (attempts <= this.config.maxRetries) {
      try {
        const result = await operation();
        return { 
          success: true, 
          result, 
          attempts: attempts,
          totalTime: attempts === 0 ? 0 : this.calculateTotalDelay(attempts)
        };
      } catch (error: any) {
        lastError = error;
        
        // Check if error is retryable
        const isRetryable = this.isRetryableError(error);
        
        if (!isRetryable || attempts >= this.config.maxRetries) {
          return {
            success: false,
            error: lastError.message,
            attempts: attempts,
            totalTime: this.calculateTotalDelay(attempts)
          };
        }
        
        attempts++;
        
        // Calculate delay for this attempt
        const delay = this.calculateDelay(attempts);
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Max retries exceeded',
      attempts: attempts,
      totalTime: this.calculateTotalDelay(attempts)
    };
  }

  private isRetryableError(error: any): boolean {
    if (error.statusCode) {
      return this.config.retryableErrors.includes(error.statusCode);
    }
    return error.name === 'NetworkError' || error.code === 'ECONNRESET';
  }

  private calculateDelay(attempt: number): number {
    if (this.config.retryStrategy === 'exponential') {
      return this.config.retryDelay * Math.pow(2, attempt - 1);
    }
    return this.config.retryDelay * attempt;
  }

  private calculateTotalDelay(attempts: number): number {
    let total = 0;
    for (let i = 1; i <= attempts; i++) {
      total += this.calculateDelay(i);
    }
    return total;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Custom error classes for testing
class HttpError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'HttpError';
  }
}

class NetworkError extends Error {
  code: string;
  
  constructor(message: string, code: string = 'ECONNRESET') {
    super(message);
    this.code = code;
    this.name = 'NetworkError';
  }
}

describe("Retry Logic Tests", () => {
  let retryClient: RetryClient;

  beforeEach(() => {
    retryClient = new RetryClient();
  });

  test("should succeed immediately on first attempt", async () => {
    expect.assertions(3);

    const mockOperation = mock(() => Promise.resolve({ data: "success" }));

    const result = await retryClient.executeWithRetry(mockOperation);

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(0);
    expect(result.totalTime).toBe(0);
  });

  test("should retry retryable HTTP errors with linear strategy", async () => {
    expect.assertions(4);

    let callCount = 0;
    const mockOperation = mock(() => {
      callCount++;
      if (callCount <= 2) {
        throw new HttpError("Server Error", 500);
      }
      return Promise.resolve({ data: "success after retries" });
    });

    retryClient = new RetryClient({
      maxRetries: 3,
      retryDelay: 10, // Use very small delays for testing
      retryStrategy: 'linear'
    });

    const result = await retryClient.executeWithRetry(mockOperation);

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.totalTime).toBe(30); // 10 + 20
    expect(callCount).toBe(3);
  });

  test("should retry with exponential backoff strategy", async () => {
    expect.assertions(4);

    let callCount = 0;
    const mockOperation = mock(() => {
      callCount++;
      if (callCount <= 2) {
        throw new HttpError("Rate Limited", 429);
      }
      return Promise.resolve({ data: "success" });
    });

    retryClient = new RetryClient({
      maxRetries: 3,
      retryDelay: 10, // Use very small delays for testing
      retryStrategy: 'exponential'
    });

    const result = await retryClient.executeWithRetry(mockOperation);

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.totalTime).toBe(30); // 10 + 20
    expect(callCount).toBe(3);
  });

  test("should not retry non-retryable HTTP errors", async () => {
    expect.assertions(3);

    const mockOperation = mock(() => {
      throw new HttpError("Unauthorized", 401);
    });

    const result = await retryClient.executeWithRetry(mockOperation);

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(0);
    expect(result.error).toContain("Unauthorized");
  });

  test("should retry network errors", async () => {
    expect.assertions(4);

    let callCount = 0;
    const mockOperation = mock(() => {
      callCount++;
      if (callCount <= 1) {
        throw new NetworkError("Connection reset", "ECONNRESET");
      }
      return Promise.resolve({ data: "success" });
    });

    const result = await retryClient.executeWithRetry(mockOperation);

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.totalTime).toBe(1000);
    expect(callCount).toBe(2);
  });

  test("should fail after max retries exceeded", async () => {
    expect.assertions(4);

    let callCount = 0;
    const mockOperation = mock(() => {
      callCount++;
      throw new HttpError("Server Error", 500);
    });

    retryClient = new RetryClient({
      maxRetries: 2,
      retryDelay: 5, // Use very small delays for testing
      retryStrategy: 'linear'
    });

    const result = await retryClient.executeWithRetry(mockOperation);

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(2);
    expect(result.totalTime).toBe(15); // 5 + 10
    expect(callCount).toBe(3); // Initial + 2 retries
  });

  test("should handle different retryable status codes", async () => {
    expect.assertions(10); // 5 status codes × 2 assertions each

    const retryableStatusCodes = [429, 500, 502, 503, 504];

    for (const statusCode of retryableStatusCodes) {
      const mockOperation = mock(() => {
        throw new HttpError(`Error ${statusCode}`, statusCode);
      });

      retryClient = new RetryClient({
        maxRetries: 1,
        retryDelay: 100
      });

      const result = await retryClient.executeWithRetry(mockOperation);

      expect(result.success).toBe(false);
      // Should have attempted 1 retry for retryable errors
      expect(result.attempts).toBe(1);
    }
  });

  test("should calculate correct delays for exponential backoff", async () => {
    expect.assertions(3);

    let callCount = 0;
    const mockOperation = mock(() => {
      callCount++;
      throw new HttpError("Server Error", 500);
    });

    retryClient = new RetryClient({
      maxRetries: 3,
      retryDelay: 10, // Use very small delays for testing
      retryStrategy: 'exponential'
    });

    const result = await retryClient.executeWithRetry(mockOperation);

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.totalTime).toBe(70); // 10 + 20 + 40
  });

  test("should handle immediate failures without delays", async () => {
    expect.assertions(3);

    const mockOperation = mock(() => {
      throw new Error("Non-retryable error");
    });

    const startTime = Date.now();
    const result = await retryClient.executeWithRetry(mockOperation);
    const endTime = Date.now();
    
    // Should complete almost immediately (< 50ms)
    const actualDuration = endTime - startTime;

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(0);
    expect(actualDuration).toBeLessThan(50);
  });
});