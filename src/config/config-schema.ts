// src/config/config-schema.ts
import { z } from 'zod';

/**
 * Environment configuration schema
 */
const EnvironmentConfigSchema = z.object({
  url: z.string().url('Invalid webhook URL'),
  headers: z.record(z.string()).default({})
});

/**
 * Webhook configuration schema
 */
const WebhookConfigSchema = z.object({
  activeEnvironment: z.string().default('test'),
  secret: z.string().optional(),
  maxRetries: z.number().int().min(0).default(3),
  retryStrategy: z.enum(['exponential', 'linear']).default('exponential'),
  retryDelay: z.number().int().min(0).default(1000),
  includeTranscript: z.boolean().default(false)
});

/**
 * Template validation configuration schema
 */
const TemplateValidationConfigSchema = z.object({
  enabled: z.boolean().default(false),
  mode: z.enum(['any', 'specific', 'disabled']).default('disabled'),
  requiredTemplateIds: z.array(z.string()).default([]),
  templateNames: z.record(z.string()).default({})
});

/**
 * Notification configuration schema
 */
const NotificationConfigSchema = z.object({
  slack: z.object({
    enabled: z.boolean().default(false),
    webhookUrl: z.string().url().optional(),
    channel: z.string().optional(),
    mentionUsers: z.array(z.string()).optional()
  }).optional(),
  discord: z.object({
    enabled: z.boolean().default(false),
    webhookUrl: z.string().url().optional()
  }).optional(),
  email: z.object({
    enabled: z.boolean().default(false),
    smtpHost: z.string().optional(),
    smtpPort: z.number().int().min(1).max(65535).optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    from: z.string().email().optional(),
    to: z.array(z.string().email()).optional()
  }).optional(),
  desktop: z.object({
    enabled: z.boolean().default(false),
    openAppOnClick: z.boolean().default(true),
    appName: z.string().default('Granola')
  }).optional()
});

/**
 * Output configuration schema
 */
const OutputConfigSchema = z.object({
  webhook: z.object({
    enabled: z.boolean().default(true),
    url: z.string().url().optional(),
    headers: z.record(z.string()).optional()
  }).optional(),
  airtable: z.object({
    enabled: z.boolean().default(false),
    apiKey: z.string().optional(),
    baseId: z.string().optional(),
    tableName: z.string().default('Meetings'),
    fieldMapping: z.record(z.string()).optional()
  }).optional(),
  googleSheets: z.object({
    enabled: z.boolean().default(false),
    spreadsheetId: z.string().optional(),
    sheetName: z.string().default('Meetings'),
    credentialsPath: z.string().optional()
  }).optional(),
  jsonFile: z.object({
    enabled: z.boolean().default(false),
    filePath: z.string().optional(),
    appendMode: z.boolean().default(true)
  }).optional()
});

/**
 * Monitoring configuration schema
 */
const MonitoringConfigSchema = z.object({
  lookbackDays: z.number().int().min(1).default(3),
  maxMeetingsPerRun: z.number().int().min(1).default(10),
  stateFilePath: z.string().default('./data/processed-meetings.json')
});

/**
 * Organization configuration schema
 */
const OrganizationConfigSchema = z.object({
  name: z.string(),
  titleKeywords: z.array(z.string()),
  emailDomains: z.array(z.string()),
  emailAddresses: z.array(z.string()).optional(),
  companyNames: z.array(z.string()).optional()
});

/**
 * Complete webhook monitor configuration schema
 */
export const WebhookMonitorConfigSchema = z.object({
  environments: z.record(EnvironmentConfigSchema),
  webhook: WebhookConfigSchema,
  templateValidation: TemplateValidationConfigSchema,
  notifications: NotificationConfigSchema,
  outputs: OutputConfigSchema,
  monitoring: MonitoringConfigSchema,
  organizations: z.array(OrganizationConfigSchema),
  defaultOrganization: z.string().default('Unknown')
});

/**
 * Type inference from schema
 */
export type WebhookMonitorConfig = z.infer<typeof WebhookMonitorConfigSchema>;

/**
 * Validates configuration and returns typed result
 */
export function validateConfig(config: unknown): WebhookMonitorConfig {
  return WebhookMonitorConfigSchema.parse(config);
}

/**
 * Safely validates configuration and returns result with errors
 */
export function safeValidateConfig(config: unknown): {
  success: boolean;
  data?: WebhookMonitorConfig;
  error?: z.ZodError;
} {
  const result = WebhookMonitorConfigSchema.safeParse(config);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}