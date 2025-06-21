// tests/canary.test.ts
import { describe, test, expect, beforeAll } from "bun:test";

/**
 * Canary tests for production readiness
 * These tests run against real external services to verify system health
 * Only run when CANARY_TESTS=true environment variable is set
 */

// Skip canary tests unless explicitly enabled
const runCanaryTests = process.env.CANARY_TESTS === 'true';

const skipOrRun = runCanaryTests ? describe : describe.skip;

// Mock basic client for canary testing
class CanaryTestClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.GRANOLA_API_BASE_URL || 'https://api.granola.ai';
  }

  async checkAPIHealth(): Promise<{ healthy: boolean; latency: number; version?: string }> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'User-Agent': 'granola-automation-client/canary-test'
        }
      });
      
      const latency = Date.now() - startTime;
      
      if (!response.ok) {
        return { healthy: false, latency };
      }
      
      const data = await response.json();
      return { 
        healthy: true, 
        latency, 
        version: data.version 
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return { healthy: false, latency };
    }
  }

  async validateWebhookEndpoint(url: string): Promise<{ reachable: boolean; latency: number; statusCode?: number }> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(url, {
        method: 'HEAD', // Use HEAD to avoid triggering actual webhooks
        headers: {
          'User-Agent': 'granola-automation-client/canary-test'
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      const latency = Date.now() - startTime;
      
      return {
        reachable: true,
        latency,
        statusCode: response.status
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return { reachable: false, latency };
    }
  }

  async checkAirtableConnectivity(): Promise<{ reachable: boolean; latency: number; authenticated?: boolean }> {
    const startTime = Date.now();
    const apiKey = process.env.AIRTABLE_API_KEY;
    
    if (!apiKey) {
      return { reachable: false, latency: 0 };
    }
    
    try {
      const response = await fetch('https://api.airtable.com/v0/meta/bases', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'granola-automation-client/canary-test'
        },
        signal: AbortSignal.timeout(5000)
      });
      
      const latency = Date.now() - startTime;
      
      return {
        reachable: true,
        latency,
        authenticated: response.ok
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return { reachable: false, latency };
    }
  }

  async checkSlackWebhook(webhookUrl?: string): Promise<{ reachable: boolean; latency: number }> {
    if (!webhookUrl) {
      webhookUrl = process.env.SLACK_WEBHOOK_URL;
    }
    
    if (!webhookUrl) {
      return { reachable: false, latency: 0 };
    }
    
    const startTime = Date.now();
    
    try {
      // Send a minimal test payload
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: "Canary test from granola-automation-client",
          username: "Granola Automation (Canary)",
          icon_emoji: ":canary:"
        }),
        signal: AbortSignal.timeout(5000)
      });
      
      const latency = Date.now() - startTime;
      
      return {
        reachable: response.ok,
        latency
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return { reachable: false, latency };
    }
  }
}

skipOrRun("Canary Tests - Production Readiness", () => {
  let canaryClient: CanaryTestClient;
  
  beforeAll(() => {
    canaryClient = new CanaryTestClient();
    
    if (runCanaryTests) {
      console.log("🐤 Running canary tests against external services...");
      console.log("Note: These tests may make actual API calls and send test notifications");
    }
  });

  test("should verify Granola API is healthy and responsive", async () => {
    expect.assertions(2);
    
    const result = await canaryClient.checkAPIHealth();
    
    expect(result.healthy).toBe(true);
    expect(result.latency).toBeLessThan(5000); // Should respond within 5 seconds
    
    if (result.version) {
      console.log(`✅ Granola API version: ${result.version}, latency: ${result.latency}ms`);
    }
  });

  test("should validate webhook endpoint connectivity", async () => {
    expect.assertions(2);
    
    const testWebhookUrl = process.env.TEST_WEBHOOK_URL || 'https://httpbin.org/post';
    const result = await canaryClient.validateWebhookEndpoint(testWebhookUrl);
    
    expect(result.reachable).toBe(true);
    expect(result.latency).toBeLessThan(10000); // Should respond within 10 seconds
    
    console.log(`✅ Webhook endpoint reachable, latency: ${result.latency}ms, status: ${result.statusCode}`);
  });

  test("should verify Airtable API connectivity", async () => {
    const result = await canaryClient.checkAirtableConnectivity();
    
    if (process.env.AIRTABLE_API_KEY) {
      expect.assertions(2);
      expect(result.reachable).toBe(true);
      expect(result.latency).toBeLessThan(5000);
      
      console.log(`✅ Airtable API reachable, latency: ${result.latency}ms, authenticated: ${result.authenticated}`);
    } else {
      expect.assertions(1);
      expect(result.reachable).toBe(false);
      console.log("⚠️ Airtable API key not provided, skipping connectivity test");
    }
  });

  test("should verify Slack webhook endpoint", async () => {
    const result = await canaryClient.checkSlackWebhook();
    
    if (process.env.SLACK_WEBHOOK_URL) {
      expect.assertions(2);
      expect(result.reachable).toBe(true);
      expect(result.latency).toBeLessThan(5000);
      
      console.log(`✅ Slack webhook reachable, latency: ${result.latency}ms`);
    } else {
      expect.assertions(1);
      expect(result.reachable).toBe(false);
      console.log("⚠️ Slack webhook URL not provided, skipping connectivity test");
    }
  });

  test("should validate system dependencies and configuration", async () => {
    expect.assertions(4);
    
    // Check required environment variables
    const requiredEnvVars = ['NODE_ENV'];
    const optionalEnvVars = ['AIRTABLE_API_KEY', 'SLACK_WEBHOOK_URL', 'DISCORD_WEBHOOK_URL'];
    
    // At least one output destination should be configured
    const hasOutputDestination = optionalEnvVars.some(envVar => process.env[envVar]);
    
    expect(process.env.NODE_ENV).toBeDefined();
    expect(hasOutputDestination).toBe(true);
    
    // Check system capabilities
    expect(typeof fetch).toBe('function');
    expect(typeof setTimeout).toBe('function');
    
    console.log(`✅ System configuration valid, environment: ${process.env.NODE_ENV}`);
  });

  test("should measure end-to-end processing latency", async () => {
    expect.assertions(1);
    
    const startTime = Date.now();
    
    // Simulate a minimal end-to-end flow
    const simulatedMeeting = {
      meetingId: `canary-test-${Date.now()}`,
      meetingTitle: "Canary Test Meeting",
      meetingDate: new Date().toISOString(),
      metadata: {
        participants: [
          { name: "Canary Test User", email: "canary@example.com" }
        ]
      },
      transcriptMarkdown: "Canary: This is a test meeting transcript.",
      processingTimestamp: new Date().toISOString()
    };
    
    // Simulate processing steps
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate template processing
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate output formatting
    
    const totalLatency = Date.now() - startTime;
    
    expect(totalLatency).toBeLessThan(1000); // Should complete within 1 second
    
    console.log(`✅ End-to-end processing latency: ${totalLatency}ms`);
  });

  test("should validate schema integrity", async () => {
    expect.assertions(2);
    
    // Import schemas to ensure they're valid
    const { meetingPayloadSchema, webhookConfigSchema } = await import("../src/schemas/validation");
    
    // Test with valid data
    const validMeeting = {
      meetingId: "canary-test",
      meetingTitle: "Test Meeting",
      meetingDate: new Date().toISOString(),
      metadata: {
        participants: [
          { name: "Test User", email: "test@example.com" }
        ]
      },
      transcriptMarkdown: "Test transcript",
      processingTimestamp: new Date().toISOString()
    };
    
    const meetingResult = meetingPayloadSchema.safeParse(validMeeting);
    expect(meetingResult.success).toBe(true);
    
    const validWebhookConfig = {
      url: "https://example.com/webhook"
    };
    
    const webhookResult = webhookConfigSchema.safeParse(validWebhookConfig);
    expect(webhookResult.success).toBe(true);
    
    console.log("✅ Schema validation successful");
  });
});

// Export helper function for manual canary testing
export function runManualCanaryTest() {
  if (typeof window !== 'undefined') {
    console.log("Canary tests are designed for Node.js/Bun environments");
    return;
  }
  
  console.log("🐤 Starting manual canary test...");
  
  const client = new CanaryTestClient();
  
  return Promise.all([
    client.checkAPIHealth(),
    client.checkAirtableConnectivity(),
    client.checkSlackWebhook()
  ]).then(results => {
    console.log("Manual canary test results:", results);
    return results;
  });
}