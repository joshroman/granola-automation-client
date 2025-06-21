// tests/schema-validation.test.ts
import { describe, test, expect } from "bun:test";
import {
  meetingPayloadSchema,
  webhookConfigSchema,
  joshTemplateContentSchema,
  airtableRequestSchema,
  stateFileSchema,
  templateValidationConfigSchema
} from "../src/schemas/validation";

/**
 * Schema validation tests using Zod
 * These tests ensure data integrity at system boundaries
 */

describe("Schema Validation Tests", () => {
  
  describe("Meeting Payload Schema", () => {
    test("should validate complete valid meeting payload", () => {
      const validPayload = {
        meetingId: "doc-123",
        meetingTitle: "Team Standup",
        meetingDate: "2025-06-21T10:00:00.000Z",
        metadata: {
          participants: [
            {
              name: "John Doe",
              email: "john@example.com",
              role: "Developer",
              company: {
                name: "TechCorp",
                domain: "example.com"
              }
            }
          ],
          duration: 1800,
          organization: "TechCorp",
          creator: {
            name: "John Doe",
            email: "john@example.com",
            company: "TechCorp"
          }
        },
        joshTemplate: {
          introduction: "Weekly team standup",
          agendaItems: "Sprint review",
          keyDecisions: "Continue current velocity",
          actionItems: "Update documentation",
          meetingNarrative: "Team discussed progress",
          otherNotes: "Next meeting scheduled"
        },
        transcriptMarkdown: "John: Good morning everyone...",
        enhancedTranscript: {
          segments: [
            {
              text: "Good morning everyone",
              start_timestamp: "2025-06-21T10:00:05.000Z",
              end_timestamp: "2025-06-21T10:00:10.000Z",
              source: "microphone",
              speaker: "John",
              start_time: new Date("2025-06-21T10:00:05.000Z"),
              end_time: new Date("2025-06-21T10:00:10.000Z"),
              confidence: 0.95
            }
          ],
          formattedMarkdown: "John: Good morning everyone"
        },
        processingTimestamp: "2025-06-21T10:30:00.000Z"
      };

      const result = meetingPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    test("should reject payload with invalid email", () => {
      const invalidPayload = {
        meetingId: "doc-123",
        meetingTitle: "Team Standup",
        meetingDate: "2025-06-21T10:00:00.000Z",
        metadata: {
          participants: [
            {
              name: "John Doe",
              email: "invalid-email", // Invalid email
              role: "Developer"
            }
          ]
        },
        transcriptMarkdown: "",
        processingTimestamp: "2025-06-21T10:30:00.000Z"
      };

      const result = meetingPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.path.includes('email') && issue.code === 'invalid_string'
        )).toBe(true);
      }
    });

    test("should reject payload with invalid date format", () => {
      const invalidPayload = {
        meetingId: "doc-123",
        meetingTitle: "Team Standup",
        meetingDate: "invalid-date", // Invalid ISO date
        metadata: {
          participants: []
        },
        transcriptMarkdown: "",
        processingTimestamp: "2025-06-21T10:30:00.000Z"
      };

      const result = meetingPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    test("should handle missing optional fields gracefully", () => {
      const minimalPayload = {
        meetingId: "doc-456",
        meetingTitle: "Quick Check-in",
        meetingDate: "2025-06-21T15:00:00.000Z",
        metadata: {
          participants: [
            {
              name: "Jane Smith",
              email: "jane@example.com"
            }
          ]
        },
        transcriptMarkdown: "",
        processingTimestamp: "2025-06-21T15:30:00.000Z"
      };

      const result = meetingPayloadSchema.safeParse(minimalPayload);
      expect(result.success).toBe(true);
    });
  });

  describe("Webhook Configuration Schema", () => {
    test("should validate complete webhook config", () => {
      const validConfig = {
        url: "https://webhook.example.com/endpoint",
        headers: {
          "X-API-Key": "secret-key",
          "Content-Type": "application/json"
        },
        secret: "webhook-secret",
        maxRetries: 3,
        retryStrategy: "exponential",
        retryDelay: 1000,
        includeTranscript: true
      };

      const result = webhookConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.maxRetries).toBe(3);
        expect(result.data.retryStrategy).toBe("exponential");
      }
    });

    test("should apply default values", () => {
      const minimalConfig = {
        url: "https://webhook.example.com/endpoint"
      };

      const result = webhookConfigSchema.safeParse(minimalConfig);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.maxRetries).toBe(3);
        expect(result.data.retryStrategy).toBe("linear");
        expect(result.data.retryDelay).toBe(1000);
        expect(result.data.includeTranscript).toBe(false);
      }
    });

    test("should reject invalid URL", () => {
      const invalidConfig = {
        url: "not-a-valid-url"
      };

      const result = webhookConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    test("should enforce retry limits", () => {
      const invalidConfig = {
        url: "https://webhook.example.com/endpoint",
        maxRetries: 15 // Too high
      };

      const result = webhookConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe("Josh Template Content Schema", () => {
    test("should validate complete template content", () => {
      const validTemplate = {
        introduction: "This is the meeting introduction",
        agendaItems: "1. Item one\n2. Item two",
        keyDecisions: "Decision to proceed with plan A",
        actionItems: "- Follow up with stakeholders\n- Schedule next meeting",
        meetingNarrative: "The team discussed various options",
        otherNotes: "Additional context and notes"
      };

      const result = joshTemplateContentSchema.safeParse(validTemplate);
      expect(result.success).toBe(true);
    });

    test("should allow empty strings for optional content", () => {
      const templateWithEmpties = {
        introduction: "Meeting intro",
        agendaItems: "",
        keyDecisions: "",
        actionItems: "",
        meetingNarrative: "",
        otherNotes: ""
      };

      const result = joshTemplateContentSchema.safeParse(templateWithEmpties);
      expect(result.success).toBe(true);
    });

    test("should reject missing required fields", () => {
      const incompleteTemplate = {
        introduction: "Meeting intro"
        // Missing other required fields
      };

      const result = joshTemplateContentSchema.safeParse(incompleteTemplate);
      expect(result.success).toBe(false);
    });
  });

  describe("Airtable Request Schema", () => {
    test("should validate Airtable record structure", () => {
      const validRequest = {
        records: [
          {
            fields: {
              'Meeting Title': "Team Standup",
              'Date': "2025-06-21",
              'Organization': "TechCorp",
              'Summary': "Weekly standup meeting",
              'Transcript': "Full meeting transcript...",
              'Participants': "John Doe, Jane Smith"
            }
          }
        ]
      };

      const result = airtableRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    test("should handle multiple records", () => {
      const multiRecordRequest = {
        records: [
          {
            fields: {
              'Meeting Title': "Standup 1",
              'Date': "2025-06-21"
            }
          },
          {
            fields: {
              'Meeting Title': "Standup 2", 
              'Date': "2025-06-22"
            }
          }
        ]
      };

      const result = airtableRequestSchema.safeParse(multiRecordRequest);
      expect(result.success).toBe(true);
    });
  });

  describe("Template Validation Config Schema", () => {
    test("should validate template validation configuration", () => {
      const validConfig = {
        enabled: true,
        mode: "specific",
        requiredTemplateIds: ["template-1", "template-2"],
        templateNames: {
          "template-1": "Josh Template",
          "template-2": "Meeting Notes Template"
        }
      };

      const result = templateValidationConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    test("should reject invalid mode", () => {
      const invalidConfig = {
        enabled: true,
        mode: "invalid-mode",
        requiredTemplateIds: [],
        templateNames: {}
      };

      const result = templateValidationConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe("State File Schema", () => {
    test("should validate state file structure", () => {
      const validState = {
        lastCheckTimestamp: "2025-06-21T10:00:00.000Z",
        processedMeetings: [
          {
            id: "doc-123",
            title: "Team Standup",
            processed_at: "2025-06-21T10:30:00.000Z",
            had_template: true,
            destination: "airtable"
          }
        ],
        failureTracking: {
          consecutiveFailures: 0,
          lastNotificationTime: null,
          lastSuccessTime: "2025-06-21T10:30:00.000Z"
        }
      };

      const result = stateFileSchema.safeParse(validState);
      expect(result.success).toBe(true);
    });

    test("should handle empty processed meetings array", () => {
      const emptyState = {
        lastCheckTimestamp: "2025-06-21T10:00:00.000Z",
        processedMeetings: [],
        failureTracking: {
          consecutiveFailures: 0,
          lastNotificationTime: null,
          lastSuccessTime: null
        }
      };

      const result = stateFileSchema.safeParse(emptyState);
      expect(result.success).toBe(true);
    });
  });

  describe("Schema Error Messages", () => {
    test("should provide helpful error messages for validation failures", () => {
      const invalidPayload = {
        meetingId: "", // Empty string not allowed
        meetingTitle: "Test",
        meetingDate: "invalid-date",
        metadata: {
          participants: [
            {
              name: "", // Empty name not allowed
              email: "invalid-email"
            }
          ]
        },
        transcriptMarkdown: "",
        processingTimestamp: "2025-06-21T10:30:00.000Z"
      };

      const result = meetingPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const issues = result.error.issues;
        expect(issues.length).toBeGreaterThan(0);
        
        // Should have specific error messages
        const emailError = issues.find(issue => 
          issue.path.includes('email') && issue.code === 'invalid_string'
        );
        expect(emailError).toBeDefined();
      }
    });
  });
});