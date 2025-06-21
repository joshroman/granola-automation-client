// src/webhook-types.ts
import type { components } from './schema';
import type { TranscriptSegmentWithSpeaker } from './transcript-types';

type Document = components['schemas']['Document'];
type DocumentMetadata = components['schemas']['DocumentMetadata'];

/**
 * Template validation configuration
 */
export interface TemplateValidationConfig {
  /** Whether template validation is enabled */
  enabled: boolean;
  
  /** Template validation mode */
  mode: 'any' | 'specific' | 'disabled';
  
  /** Array of required template IDs */
  requiredTemplateIds: string[];
  
  /** Mapping of template IDs to friendly names */
  templateNames: Record<string, string>;
}

/**
 * Notification channel configurations
 */
export interface NotificationConfig {
  /** Slack notification settings */
  slack?: {
    enabled: boolean;
    webhookUrl?: string;
    channel?: string;
    mentionUsers?: string[];
  };
  
  /** Discord notification settings */
  discord?: {
    enabled: boolean;
    webhookUrl?: string;
  };
  
  /** Email notification settings */
  email?: {
    enabled: boolean;
    smtpHost?: string;
    smtpPort?: number;
    username?: string;
    password?: string;
    from?: string;
    to?: string[];
  };
  
  /** Desktop notification settings */
  desktop?: {
    enabled: boolean;
    openAppOnClick?: boolean;
    appName?: string;
  };
}

/**
 * Output destination configurations
 */
export interface OutputConfig {
  /** Webhook output settings */
  webhook?: {
    enabled: boolean;
    url?: string;
    headers?: Record<string, string>;
  };
  
  /** Airtable output settings */
  airtable?: {
    enabled: boolean;
    apiKey?: string;
    baseId?: string;
    tableName?: string;
  };
  
  /** Google Sheets output settings */
  googleSheets?: {
    enabled: boolean;
    spreadsheetId?: string;
    sheetName?: string;
    credentialsPath?: string;
  };
  
  /** JSON file output settings */
  jsonFile?: {
    enabled: boolean;
    filePath?: string;
    appendMode?: boolean;
  };
}

/**
 * Webhook configuration options
 */
export interface WebhookConfig {
  /** The URL to send webhook requests to */
  url: string;
  
  /** Optional custom headers to include with webhook requests */
  headers?: Record<string, string>;
  
  /** Optional secret for signing webhook requests */
  secret?: string;
  
  /** Maximum retry attempts for failed webhook deliveries (default: 3) */
  maxRetries?: number;
  
  /** Retry backoff strategy - linear (default) or exponential */
  retryStrategy?: 'linear' | 'exponential';
  
  /** Base retry delay in milliseconds (default: 1000) */
  retryDelay?: number;
  
  /** Whether to include the full transcript in the payload (default: false) */
  includeTranscript?: boolean;
}

/**
 * Meeting participant information
 */
export interface MeetingParticipant {
  /** Participant name */
  name: string;
  
  /** Participant email */
  email: string;
  
  /** Participant's role (if available) */
  role?: string;
  
  /** Participant's company information */
  company?: {
    /** Company name */
    name?: string;
    
    /** Company domain */
    domain?: string;
  };
}

/**
 * Organization metadata derived from meeting participants
 */
export interface OrganizationInfo {
  /** Detected organization name */
  name: string;
  
  /** Confidence level in the organization detection (0-1) */
  confidence: number;
  
  /** Detection signals that led to this determination */
  signals: {
    /** Whether title contains organization keywords */
    titleMatch?: boolean;
    
    /** Whether creator email domain matches organization */
    creatorDomainMatch?: boolean;
    
    /** Whether creator company name matches organization */
    creatorCompanyMatch?: boolean;
    
    /** Number of attendees with matching email domains */
    matchingDomainAttendees?: number;
    
    /** Total number of attendees with known email domains */
    totalAttendeesWithDomain?: number;
  };
}

/**
 * Josh Template content structure
 */
export interface JoshTemplateContent {
  /** Introduction section */
  introduction?: string;
  
  /** Agenda items */
  agendaItems?: string;
  
  /** Key decisions made in the meeting */
  keyDecisions?: string;
  
  /** Action items from the meeting */
  actionItems?: string;
  
  /** Meeting narrative summary */
  meetingNarrative?: string;
  
  /** Other discussion points and notes */
  otherNotes?: string;
}

/**
 * Enhanced transcript information
 */
export interface EnhancedTranscript {
  /** Original transcript segments with speaker identification */
  segments?: TranscriptSegmentWithSpeaker[];
}

/**
 * Complete meeting information payload
 */
export interface MeetingPayload {
  /** Meeting ID */
  meetingId: string;
  
  /** Meeting title */
  meetingTitle: string;
  
  /** When the meeting was created */
  meetingDate: string;
  
  /** Detailed meeting metadata */
  metadata: {
    /** Meeting participants */
    participants: MeetingParticipant[];
    
    /** Meeting duration in seconds */
    duration?: number;
    
    /** Organization information */
    organization?: OrganizationInfo;
    
    /** Meeting creator information */
    creator?: {
      /** Creator name */
      name?: string;
      
      /** Creator email */
      email?: string;
      
      /** Creator company */
      company?: string;
    };
  };
  
  /** Josh Template content sections */
  joshTemplate?: JoshTemplateContent;
  
  /** Formatted transcript as markdown with speakers grouped */
  transcriptMarkdown?: string;
  
  /** Enhanced transcript with speaker identification */
  enhancedTranscript?: EnhancedTranscript;
  
  /** When this payload was generated */
  processingTimestamp: string;
}

/**
 * Webhook delivery result
 */
export interface WebhookResult {
  /** Whether the webhook delivery was successful */
  success: boolean;
  
  /** Whether the meeting was skipped from processing */
  skipped?: boolean;
  
  /** Reason for skipping (e.g., 'missing_josh_template', 'invalid_meeting') */
  skipReason?: string;
  
  /** HTTP status code from the webhook endpoint */
  statusCode?: number;
  
  /** Response body from the webhook endpoint */
  response?: any;
  
  /** Error message if delivery failed */
  error?: string;
  
  /** Number of retry attempts made */
  retries?: number;
}