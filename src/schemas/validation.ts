// src/schemas/validation.ts
import { z } from 'zod';

/**
 * Zod schemas for data validation throughout the application
 * These provide runtime type checking and prevent data corruption
 */

// Basic primitives
export const emailSchema = z.string().email();
export const urlSchema = z.string().url();
export const isoDateSchema = z.string().datetime();

// Template validation schemas
export const templateValidationConfigSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['any', 'specific', 'disabled']),
  requiredTemplateIds: z.array(z.string()),
  templateNames: z.record(z.string(), z.string())
});

// Notification configuration schemas
export const slackConfigSchema = z.object({
  enabled: z.boolean(),
  webhookUrl: urlSchema.optional(),
  channel: z.string().optional(),
  mentionUsers: z.array(z.string()).optional()
});

export const discordConfigSchema = z.object({
  enabled: z.boolean(),
  webhookUrl: urlSchema.optional(),
  mentionRoles: z.array(z.string()).optional()
});

export const emailConfigSchema = z.object({
  enabled: z.boolean(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  from: emailSchema.optional(),
  to: z.array(emailSchema).optional()
});

export const notificationConfigSchema = z.object({
  slack: slackConfigSchema.optional(),
  discord: discordConfigSchema.optional(),
  email: emailConfigSchema.optional()
});

// Webhook configuration schema
export const webhookConfigSchema = z.object({
  url: urlSchema,
  headers: z.record(z.string(), z.string()).optional(),
  secret: z.string().optional(),
  maxRetries: z.number().int().min(0).max(10).default(3),
  retryStrategy: z.enum(['linear', 'exponential']).default('linear'),
  retryDelay: z.number().int().min(100).max(30000).default(1000),
  includeTranscript: z.boolean().default(false)
});

// Meeting participant schema
export const meetingParticipantSchema = z.object({
  name: z.string().min(1),
  email: emailSchema,
  role: z.string().optional(),
  company: z.object({
    name: z.string().optional(),
    domain: z.string().optional()
  }).optional()
});

// Josh Template content schema
export const joshTemplateContentSchema = z.object({
  introduction: z.string(),
  agendaItems: z.string(),
  keyDecisions: z.string(),
  actionItems: z.string(),
  meetingNarrative: z.string(),
  otherNotes: z.string()
});

// Enhanced transcript schema
export const transcriptSegmentSchema = z.object({
  text: z.string(),
  start_timestamp: isoDateSchema,
  end_timestamp: isoDateSchema,
  source: z.enum(['microphone', 'system']),
  speaker: z.string(),
  start_time: z.union([z.date(), isoDateSchema]), // Allow both Date and string
  end_time: z.union([z.date(), isoDateSchema]), // Allow both Date and string
  confidence: z.number().min(0).max(1)
});

export const enhancedTranscriptSchema = z.object({
  segments: z.array(transcriptSegmentSchema),
  formattedMarkdown: z.string().optional() // Make optional
});

// Meeting payload schema (what gets sent to webhooks)
export const meetingPayloadSchema = z.object({
  meetingId: z.string(),
  meetingTitle: z.string(),
  meetingDate: isoDateSchema,
  metadata: z.object({
    participants: z.array(meetingParticipantSchema),
    duration: z.number().optional(),
    organization: z.union([
      z.string(),
      z.object({
        name: z.string(),
        confidence: z.number().optional(),
        signals: z.object({
          titleMatch: z.boolean().optional()
        }).optional()
      })
    ]).optional(),
    creator: z.object({
      name: z.string().optional(),
      email: emailSchema.optional(),
      company: z.string().optional()
    }).optional()
  }),
  joshTemplate: joshTemplateContentSchema.optional(),
  transcriptMarkdown: z.string(),
  enhancedTranscript: enhancedTranscriptSchema.optional(),
  processingTimestamp: isoDateSchema
});

// Webhook result schema
export const webhookResultSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  statusCode: z.number().optional(),
  retries: z.number().optional(), // Use 'retries' not 'retryCount'
  response: z.string().optional(),
  timestamp: isoDateSchema.optional()
});

// Airtable output schema
export const airtableRecordSchema = z.object({
  fields: z.object({
    'Meeting Title': z.string(),
    'Date': z.string(),
    'Organization': z.string().optional(),
    'Summary': z.string().optional(),
    'Transcript': z.string().optional(),
    'Participants': z.string().optional()
  })
});

export const airtableRequestSchema = z.object({
  records: z.array(airtableRecordSchema)
});

// Google Sheets output schema
export const googleSheetsRowSchema = z.array(z.string()); // Array of cell values

// State management schemas
export const processedMeetingSchema = z.object({
  id: z.string(),
  title: z.string(),
  processed_at: isoDateSchema,
  had_template: z.boolean(),
  destination: z.string().optional()
});

export const stateFileSchema = z.object({
  lastCheckTimestamp: isoDateSchema,
  processedMeetings: z.array(processedMeetingSchema),
  failureTracking: z.object({
    consecutiveFailures: z.number().int().min(0),
    lastNotificationTime: isoDateSchema.nullable(),
    lastSuccessTime: isoDateSchema.nullable()
  })
});

// Export type inference helpers
export type TemplateValidationConfig = z.infer<typeof templateValidationConfigSchema>;
export type WebhookConfig = z.infer<typeof webhookConfigSchema>;
export type MeetingPayload = z.infer<typeof meetingPayloadSchema>;
export type WebhookResult = z.infer<typeof webhookResultSchema>;
export type AirtableRequest = z.infer<typeof airtableRequestSchema>;
export type ProcessedMeeting = z.infer<typeof processedMeetingSchema>;
export type StateFile = z.infer<typeof stateFileSchema>;