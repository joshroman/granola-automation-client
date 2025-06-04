import { describe, test, expect, beforeEach, mock, afterEach } from "bun:test";
import { WebhookClient, OrganizationDetector } from "../src/webhook-client";
import { MeetingPayload, WebhookResult } from "../src/webhook-types";

// Mock data for testing
const mockDocument = {
  id: "doc-123",
  document_id: "doc-123",
  title: "Test Meeting",
  created_at: "2025-06-03T10:00:00.000Z",
  people: {
    creator: {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      details: {
        company: { name: "Test Company" }
      }
    },
    attendees: [
      {
        id: "user-1",
        name: "Test User",
        email: "test@example.com"
      },
      {
        id: "user-2",
        name: "Another User",
        email: "another@example.org"
      }
    ]
  }
};

const mockPanels = [
  {
    id: "panel-123",
    title: "Summary",
    document_id: "doc-123",
    created_at: "2025-06-03T10:10:00Z",
    updated_at: "2025-06-03T10:15:00Z",
    content_updated_at: "2025-06-03T10:15:00Z",
    template_slug: "b491d27c-1106-4ebf-97c5-d5129742945c", // Josh Template ID
    deleted_at: null,
    affinity_note_id: null,
    content: { type: "doc", content: [] },
    original_content: "<h1>Introduction</h1><p>This is a test meeting.</p><h1>Agenda Items</h1><p>Item 1</p><h1>Key Decisions</h1><p>Decision 1</p>",
    suggested_questions: null,
    generated_lines: [],
    user_feedback: null
  }
];

const mockTranscriptWithSpeakers = [
  {
    text: "Hello, this is a test",
    start_timestamp: "2025-06-03T10:00:05.000Z",
    end_timestamp: "2025-06-03T10:00:10.000Z",
    source: "microphone",
    speaker: "Me",
    start_time: new Date("2025-06-03T10:00:05.000Z"),
    end_time: new Date("2025-06-03T10:00:10.000Z"),
    confidence: 1.0
  },
  {
    text: "Hello, I can hear you",
    start_timestamp: "2025-06-03T10:00:12.000Z",
    end_timestamp: "2025-06-03T10:00:15.000Z",
    source: "system",
    speaker: "Them",
    start_time: new Date("2025-06-03T10:00:12.000Z"),
    end_time: new Date("2025-06-03T10:00:15.000Z"),
    confidence: 1.0
  }
];

// Mock fetch implementation
const originalFetch = global.fetch;

describe("WebhookClient", () => {
  let client: WebhookClient;
  
  // Mocks for client methods
  let mockGetDocuments: any;
  let mockGetDocumentMetadata: any;
  let mockGetDocumentPanels: any;
  let mockGetDocumentTranscriptWithSpeakers: any;
  let mockFetch: any;
  
  beforeEach(() => {
    // Create a test client
    client = new WebhookClient("test-token");
    
    // Mock methods
    mockGetDocuments = mock(() => Promise.resolve({ docs: [mockDocument] }));
    mockGetDocumentMetadata = mock(() => Promise.resolve(mockDocument));
    mockGetDocumentPanels = mock(() => Promise.resolve(mockPanels));
    mockGetDocumentTranscriptWithSpeakers = mock(() => Promise.resolve(mockTranscriptWithSpeakers));
    
    // Replace methods on client
    // @ts-ignore - Accessing private methods for testing
    client.getDocuments = mockGetDocuments;
    // @ts-ignore - Accessing private methods for testing
    client.getDocumentMetadata = mockGetDocumentMetadata;
    // @ts-ignore - Accessing private methods for testing
    client.getDocumentPanels = mockGetDocumentPanels;
    // @ts-ignore - Accessing private methods for testing
    client.transcriptClient = { 
      getDocumentTranscriptWithSpeakers: mockGetDocumentTranscriptWithSpeakers 
    };
    
    // Mock fetch for webhook calls
    mockFetch = mock(() => 
      Promise.resolve(new Response("OK", { status: 200 }))
    );
    global.fetch = mockFetch;
  });
  
  afterEach(() => {
    // Restore fetch
    global.fetch = originalFetch;
  });
  
  test("setWebhookConfig should store webhook configuration", () => {
    const config = {
      url: "https://example.com/webhook",
      headers: { "X-API-Key": "test-key" },
      maxRetries: 5
    };
    
    client.setWebhookConfig(config);
    
    // @ts-ignore - Accessing private property for testing
    expect(client.webhookConfig).toEqual(config);
  });
  
  test("processMeeting should throw error if no webhook config is set", async () => {
    await expect(client.processMeeting("doc-123")).rejects.toThrow("No webhook configuration set");
  });
  
  test("processMeeting should process meeting and send to webhook", async () => {
    // Set webhook config
    client.setWebhookConfig({
      url: "https://example.com/webhook",
      includeTranscript: true
    });
    
    // Process a meeting
    const result = await client.processMeeting("doc-123");
    
    // Verify API calls were made
    expect(mockGetDocumentPanels).toHaveBeenCalledWith("doc-123");
    expect(mockGetDocumentTranscriptWithSpeakers).toHaveBeenCalledWith("doc-123");
    
    // Verify webhook was called
    expect(mockFetch).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
  
  test("processMeeting should extract Josh Template sections", async () => {
    // Set webhook config
    client.setWebhookConfig({
      url: "https://example.com/webhook"
    });
    
    // Process meeting
    await client.processMeeting("doc-123");
    
    // Get the payload that was sent to fetch
    const fetchCall = mockFetch.mock.calls[0];
    const fetchOptions = fetchCall[1];
    const payload = JSON.parse(fetchOptions.body);
    
    // Verify Josh Template sections were extracted
    expect(payload.joshTemplate).toBeDefined();
    expect(payload.joshTemplate.introduction).toContain("This is a test meeting");
    expect(payload.joshTemplate.agendaItems).toContain("Item 1");
    expect(payload.joshTemplate.keyDecisions).toContain("Decision 1");
  });
  
  test("processMeeting should detect organization", async () => {
    // Create organization detector with test config
    const detector = new OrganizationDetector({
      organizations: [
        {
          name: "Test Org",
          titleKeywords: ["test"],
          emailDomains: ["example.com"],
          emailAddresses: ["test@example.com"]
        }
      ],
      defaultOrganization: "Unknown"
    });
    
    // Set detector and webhook config
    client.setOrganizationDetector(detector);
    client.setWebhookConfig({
      url: "https://example.com/webhook"
    });
    
    // Process meeting
    await client.processMeeting("doc-123");
    
    // Get the payload that was sent to fetch
    const fetchCall = mockFetch.mock.calls[0];
    const fetchOptions = fetchCall[1];
    const payload = JSON.parse(fetchOptions.body);
    
    // Verify organization was detected
    expect(payload.metadata.organization).toBeDefined();
    expect(payload.metadata.organization.name).toBe("Test Org");
  });
  
  test("processUnprocessedMeetings should process multiple meetings", async () => {
    // Mock multiple documents
    // @ts-ignore - Accessing private methods for testing
    client.getDocuments = mock(() => Promise.resolve({ 
      docs: [
        { ...mockDocument, id: "doc-123", document_id: "doc-123", title: "Meeting 1" },
        { ...mockDocument, id: "doc-456", document_id: "doc-456", title: "Meeting 2" }
      ] 
    }));
    
    // Set webhook config
    client.setWebhookConfig({
      url: "https://example.com/webhook"
    });
    
    // Process with empty processed set
    const results = await client.processUnprocessedMeetings(
      new Date("2025-06-01"),
      new Set(),
      10
    );
    
    // Should process both meetings
    expect(results.length).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    
    // Process again with the same meetings already processed
    const processedIds = new Set(["doc-123", "doc-456"]);
    const newResults = await client.processUnprocessedMeetings(
      new Date("2025-06-01"),
      processedIds,
      10
    );
    
    // Should not process any meetings
    expect(newResults.length).toBe(0);
    // Fetch count should remain at 2 (not increase)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
  
  test("sendToWebhook should retry on failure", async () => {
    // Mock fetch to fail then succeed
    const mockFailThenSucceed = mock()
      // First call fails
      .mockImplementationOnce(() => Promise.reject(new Error("Network error")))
      // Second call succeeds
      .mockImplementationOnce(() => Promise.resolve(new Response("OK", { status: 200 })));
      
    global.fetch = mockFailThenSucceed;
    
    // Set webhook config with retry
    client.setWebhookConfig({
      url: "https://example.com/webhook",
      maxRetries: 1,
      retryDelay: 10 // Small delay for testing
    });
    
    // Process meeting
    const result = await client.processMeeting("doc-123");
    
    // Should have retried and succeeded
    expect(mockFailThenSucceed).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(result.retries).toBe(1);
  });
});