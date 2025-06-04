// src/webhook-client.ts
import { PanelClient } from './panel-client';
import { TranscriptClient } from './transcript-client';
import type { 
  WebhookConfig, 
  MeetingPayload, 
  MeetingParticipant, 
  WebhookResult,
  OrganizationInfo,
  JoshTemplateContent,
  EnhancedTranscript
} from './webhook-types';
import type { components } from './schema';

// Import organization detector
import * as fsExtra from 'fs';
import * as pathExtra from 'path';

/**
 * Configuration interface for organization detection
 */
export interface OrganizationConfig {
  /** Organization name */
  name: string;
  
  /** Keywords to look for in meeting titles */
  titleKeywords: string[];
  
  /** Email domains associated with this organization */
  emailDomains: string[];
  
  /** Specific email addresses associated with this organization */
  emailAddresses?: string[];
  
  /** Company names associated with this organization */
  companyNames?: string[];
}

/**
 * Configuration for the organization detector
 */
export interface OrganizationDetectorConfig {
  /** List of organizations to detect */
  organizations: OrganizationConfig[];
  
  /** Default organization to use if no match is found */
  defaultOrganization?: string;
  
  /** Whether to use calendar data for detection (default: true) */
  useCalendarData?: boolean;
  
  /** Whether to use people data for detection (default: true) */
  usePeopleData?: boolean;
  
  /** Whether to use title keywords for detection (default: true) */
  useTitleKeywords?: boolean;
}

const DEFAULT_CONFIG: OrganizationDetectorConfig = {
  organizations: [
    {
      name: "Organization1",
      titleKeywords: ["org1", "organization1"],
      emailDomains: ["org1.com", "organization1.com"],
      emailAddresses: ["admin@org1.com"],
      companyNames: ["Organization One, Inc."]
    },
    {
      name: "Organization2",
      titleKeywords: ["org2", "organization2"],
      emailDomains: ["org2.org", "organization2.org"],
      emailAddresses: ["admin@org2.org"],
      companyNames: ["Organization Two, LLC"]
    }
  ],
  defaultOrganization: "Unknown",
  useCalendarData: true,
  usePeopleData: true,
  useTitleKeywords: true
};

/**
 * Class for detecting organization affiliation of meetings
 */
export class OrganizationDetector {
  private config: OrganizationDetectorConfig;
  
  /**
   * Create a new OrganizationDetector
   * @param config Configuration for organization detection
   */
  constructor(config: OrganizationDetectorConfig = DEFAULT_CONFIG) {
    this.config = config;
  }
  
  /**
   * Determine the organization for a meeting
   * @param meeting Meeting data object
   * @returns Organization name or undefined if not detected
   */
  public detectOrganization(meeting: any): string | undefined {
    if (!meeting) return this.config.defaultOrganization;
    
    // Detection methods in priority order
    const detectionMethods: {method: () => string | undefined, enabled: boolean}[] = [
      // Calendar data (highest priority)
      { 
        method: () => this.detectFromCalendarData(meeting.google_calendar_event),
        enabled: this.config.useCalendarData !== false 
      },
      // Title-based detection (second priority)
      { 
        method: () => this.detectFromTitle(meeting.title),
        enabled: this.config.useTitleKeywords !== false 
      },
      // People data (lowest priority)
      { 
        method: () => this.detectFromPeopleData(meeting.people),
        enabled: this.config.usePeopleData !== false 
      }
    ];
    
    // Try each method in order of priority
    for (const { method, enabled } of detectionMethods) {
      if (enabled) {
        const org = method();
        if (org) return org;
      }
    }
    
    // Default organization if none detected
    return this.config.defaultOrganization;
  }
  
  private detectFromTitle(title?: string): string | undefined {
    if (!title) return undefined;
    
    const titleLower = title.toLowerCase();
    
    for (const org of this.config.organizations) {
      for (const keyword of org.titleKeywords) {
        if (titleLower.includes(keyword.toLowerCase())) {
          return org.name;
        }
      }
    }
    
    return undefined;
  }
  
  private detectFromCalendarData(calendarEvent?: any): string | undefined {
    if (!calendarEvent) return undefined;
    
    // Check calendar creator email
    if (calendarEvent.creator?.email) {
      const creatorEmail = calendarEvent.creator.email.toLowerCase();
      
      // Check for direct email matches
      for (const org of this.config.organizations) {
        if (org.emailAddresses?.some(email => email.toLowerCase() === creatorEmail)) {
          return org.name;
        }
      }
      
      // Check email domain
      const domain = creatorEmail.split('@')[1];
      for (const org of this.config.organizations) {
        if (org.emailDomains.some(d => domain.includes(d.toLowerCase()))) {
          return org.name;
        }
      }
    }
    
    // Check attendee domains if creator didn't give us a match
    if (Array.isArray(calendarEvent.attendees) && calendarEvent.attendees.length > 0) {
      const domainCounts: Record<string, number> = {};
      
      // Count domains by organization
      for (const attendee of calendarEvent.attendees) {
        if (attendee.email) {
          const email = attendee.email.toLowerCase();
          const domain = email.split('@')[1];
          
          for (const org of this.config.organizations) {
            if (org.emailDomains.some(d => domain.includes(d.toLowerCase()))) {
              domainCounts[org.name] = (domainCounts[org.name] || 0) + 1;
            }
          }
        }
      }
      
      // Find organization with most attendees
      let maxCount = 0;
      let primaryOrg = undefined;
      
      for (const [org, count] of Object.entries(domainCounts)) {
        if (count > maxCount) {
          maxCount = count;
          primaryOrg = org;
        }
      }
      
      if (primaryOrg) return primaryOrg;
    }
    
    return undefined;
  }
  
  private detectFromPeopleData(people?: any): string | undefined {
    if (!people) return undefined;
    
    // Check creator's company
    if (people.creator?.details?.company?.name) {
      const companyName = people.creator.details.company.name.toLowerCase();
      
      for (const org of this.config.organizations) {
        if (org.companyNames?.some(name => companyName.includes(name.toLowerCase()))) {
          return org.name;
        }
      }
    }
    
    // Check creator email
    if (people.creator?.email) {
      const creatorEmail = people.creator.email.toLowerCase();
      
      // Check for direct email matches
      for (const org of this.config.organizations) {
        if (org.emailAddresses?.some(email => email.toLowerCase() === creatorEmail)) {
          return org.name;
        }
      }
      
      // Check email domain
      const domain = creatorEmail.split('@')[1];
      for (const org of this.config.organizations) {
        if (org.emailDomains.some(d => domain.includes(d.toLowerCase()))) {
          return org.name;
        }
      }
    }
    
    // Count attendee domains
    if (Array.isArray(people.attendees) && people.attendees.length > 0) {
      const domainCounts: Record<string, number> = {};
      
      // Count domains by organization
      for (const attendee of people.attendees) {
        if (attendee.email) {
          const email = attendee.email.toLowerCase();
          const domain = email.split('@')[1];
          
          for (const org of this.config.organizations) {
            if (org.emailDomains.some(d => domain.includes(d.toLowerCase()))) {
              domainCounts[org.name] = (domainCounts[org.name] || 0) + 1;
            }
          }
        }
      }
      
      // Find organization with most attendees
      let maxCount = 0;
      let primaryOrg = undefined;
      
      for (const [org, count] of Object.entries(domainCounts)) {
        if (count > maxCount) {
          maxCount = count;
          primaryOrg = org;
        }
      }
      
      if (primaryOrg) return primaryOrg;
    }
    
    return undefined;
  }
  
  /**
   * Load configuration from a file
   * @param filePath Path to configuration file
   * @returns New OrganizationDetector with loaded configuration
   * @static
   */
  public static fromFile(filePath: string): OrganizationDetector {
    try {
      // In a Node.js environment:
      if (typeof require === 'function') {
        const fs = require('fs');
        const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return new OrganizationDetector(config);
      }
      
      // In a browser/Bun environment:
      if (typeof Bun !== 'undefined') {
        const file = Bun.file(filePath);
        const text = file.toString();
        const config = JSON.parse(text);
        return new OrganizationDetector(config);
      }
      
      console.warn(`Could not load configuration from ${filePath}, using default config`);
      return new OrganizationDetector();
    } catch (error) {
      console.error(`Error loading organization config: ${error}`);
      return new OrganizationDetector();
    }
  }
}

// Type aliases for clarity
type Document = components['schemas']['Document'];
type DocumentMetadata = components['schemas']['DocumentMetadata'];
type TranscriptSegment = components['schemas']['TranscriptSegment'];

/**
 * Client for sending Granola meeting data to webhooks.
 * Extends PanelClient to access both panel and transcript features.
 * 
 * This client allows you to:
 * - Extract structured meeting data including metadata and transcripts
 * - Send formatted meeting data to webhooks (e.g., n8n)
 * - Process meeting data with retry logic and failure handling
 * 
 * @example
 * ```ts
 * // Initialize the webhook client
 * const client = new WebhookClient();
 * 
 * // Configure a webhook endpoint
 * client.setWebhookConfig({
 *   url: 'https://n8n.example.com/webhook/granola',
 *   headers: { 'X-Api-Key': 'your-api-key' },
 *   includeTranscript: true
 * });
 * 
 * // Process and send a meeting to the webhook
 * await client.processMeeting('document-id');
 * ```
 */
export class WebhookClient extends PanelClient {
  private transcriptClient: TranscriptClient;
  private organizationDetector: OrganizationDetector;
  private webhookConfig: WebhookConfig | null = null;
  private joshTemplateId: string = 'b491d27c-1106-4ebf-97c5-d5129742945c';
  
  /**
   * Create a new WebhookClient.
   * Inherits PanelClient capabilities and adds webhook integration.
   * 
   * @param token API authentication token (optional - will be automatically retrieved if not provided)
   * @param opts HTTP and client options
   * @param webhookConfig Optional initial webhook configuration
   * @param organizationConfig Optional organization detector configuration
   */
  constructor(
    token?: string, 
    opts: any = {}, 
    webhookConfig?: WebhookConfig,
    organizationConfig?: any
  ) {
    super(token, opts);
    
    // Initialize transcript client with the same credentials
    this.transcriptClient = new TranscriptClient(token, opts);
    
    // Initialize organization detector
    this.organizationDetector = organizationConfig ? 
      new OrganizationDetector(organizationConfig) : 
      new OrganizationDetector();
    
    // Set webhook config if provided
    if (webhookConfig) {
      this.webhookConfig = webhookConfig;
    }
  }
  
  /**
   * Set the webhook configuration.
   * @param config The webhook configuration to use
   */
  public setWebhookConfig(config: WebhookConfig): void {
    this.webhookConfig = config;
  }
  
  /**
   * Set the Josh Template ID.
   * @param templateId The ID of the Josh Template to look for
   */
  public setJoshTemplateId(templateId: string): void {
    this.joshTemplateId = templateId;
  }
  
  /**
   * Set the organization detector.
   * @param detector The organization detector to use
   */
  public setOrganizationDetector(detector: OrganizationDetector): void {
    this.organizationDetector = detector;
  }
  
  /**
   * Process a meeting document and send it to the configured webhook.
   * @param documentId The ID of the document to process
   * @returns Result of the webhook delivery
   * @throws Error if no webhook configuration has been set
   */
  public async processMeeting(documentId: string): Promise<WebhookResult> {
    if (!this.webhookConfig) {
      throw new Error("No webhook configuration set. Call setWebhookConfig() first.");
    }
    
    try {
      // 1. Get document metadata
      const document = await this.getMeetingDocument(documentId);
      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }
      
      // 2. Get document panels
      const panels = await this.getDocumentPanels(documentId);
      
      // 3. Look for Josh Template panel
      const joshPanel = panels.find(panel => panel.template_slug === this.joshTemplateId);
      
      // 4. Extract Josh Template content
      let joshTemplateContent: JoshTemplateContent | undefined;
      if (joshPanel) {
        const sections = this.extractStructuredContent(joshPanel);
        joshTemplateContent = {
          introduction: sections['Introduction'],
          agendaItems: sections['Agenda Items'],
          keyDecisions: sections['Key Decisions'],
          actionItems: sections['Action Items'],
          meetingNarrative: sections['Meeting Narrative'],
          otherNotes: sections['Other Discussion & Notes']
        };
      }
      
      // 5. Get enhanced transcript and markdown format
      let enhancedTranscript: EnhancedTranscript | undefined;
      let transcriptMarkdown: string | undefined;
      
      if (this.webhookConfig.includeTranscript) {
        const transcriptWithSpeakers = 
          await this.transcriptClient.getDocumentTranscriptWithSpeakers(documentId);
        
        // Format transcript as markdown
        transcriptMarkdown = await this.formatTranscriptMarkdown(transcriptWithSpeakers);
        
        enhancedTranscript = {
          segments: this.webhookConfig.includeTranscript ? transcriptWithSpeakers : undefined
        };
      }
      
      // 6. Prepare webhook payload
      const payload = await this.buildMeetingPayload(
        document,
        joshTemplateContent,
        transcriptMarkdown,
        enhancedTranscript
      );
      
      // 7. Send to webhook with retries
      return await this.sendToWebhook(payload);
    } catch (error) {
      console.error("Error processing meeting:", error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
  
  /**
   * Fetch all meeting information from the document ID.
   * @param documentId The ID of the document to fetch
   * @returns The document with detailed information
   * @private
   */
  private async getMeetingDocument(documentId: string): Promise<Document | null> {
    try {
      // First try to get the document from the documents list
      const documents = await this.getDocuments({ limit: 1 });
      if (documents.docs && documents.docs.length > 0) {
        const doc = documents.docs.find(d => (d.document_id || d.id) === documentId);
        if (doc) return doc;
      }
      
      // If not found, try direct metadata access
      const metadata = await this.getDocumentMetadata(documentId);
      if (metadata) {
        // Convert metadata to document format
        return {
          id: documentId,
          document_id: documentId,
          title: metadata.title || "",
          created_at: new Date().toISOString(), // Fallback
          creator_id: metadata.creator?.id || "",
          people: {
            creator: metadata.creator,
            attendees: metadata.attendees || []
          },
          // Add other fields as needed
        };
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching meeting document: ${error}`);
      return null;
    }
  }
  
  /**
   * Format transcript segments as markdown grouped by speaker.
   * @param segments The transcript segments with speaker information
   * @returns Formatted markdown transcript
   * @private
   */
  private async formatTranscriptMarkdown(segments: any[]): Promise<string> {
    // This is similar to the TranscriptClient's exportTranscriptMarkdown method
    // but returns the string instead of writing to a file and consolidates segments
    
    let content = " \n";  // Start with a blank line
    
    let currentSpeaker: string | null = null;
    let speakerSegments: string[] = [];
    
    for (const segment of segments) {
      // If speaker changes or this is the first segment, write the accumulated text
      if (currentSpeaker !== null && currentSpeaker !== segment.speaker) {
        // Write the accumulated text for the previous speaker
        content += `${currentSpeaker}:  \n`;
        
        // Join all segments from this speaker into a single paragraph
        const consolidatedText = speakerSegments.join(' ').trim();
        content += `${consolidatedText}  \n\n`;
        
        // Reset for the new speaker
        speakerSegments = [];
      }
      
      // Update current speaker and add this text
      currentSpeaker = segment.speaker;
      
      // Only add non-empty segments
      if (segment.text?.trim()) {
        speakerSegments.push(segment.text);
      }
    }
    
    // Write the final speaker's text
    if (currentSpeaker !== null && speakerSegments.length) {
      content += `${currentSpeaker}:  \n`;
      const consolidatedText = speakerSegments.join(' ').trim();
      content += `${consolidatedText}  \n`;
    }
    
    return content;
  }
  
  /**
   * Build complete meeting payload for webhook delivery.
   * @param document The document metadata
   * @param joshTemplateContent Optional Josh Template content
   * @param transcriptMarkdown Optional formatted transcript markdown
   * @param enhancedTranscript Optional enhanced transcript
   * @returns Complete meeting payload
   * @private
   */
  private async buildMeetingPayload(
    document: Document, 
    joshTemplateContent?: JoshTemplateContent,
    transcriptMarkdown?: string,
    enhancedTranscript?: EnhancedTranscript
  ): Promise<MeetingPayload> {
    // Extract participant information
    const participants: MeetingParticipant[] = [];
    
    // Add creator
    if (document.people?.creator) {
      participants.push({
        name: document.people.creator.name || 'Unknown',
        email: document.people.creator.email || 'unknown@example.com',
        role: 'Creator',
        company: document.people.creator.details?.company ? {
          name: document.people.creator.details.company.name,
          domain: document.people.creator.email?.split('@')[1]
        } : undefined
      });
    }
    
    // Add attendees
    if (Array.isArray(document.people?.attendees)) {
      for (const attendee of document.people.attendees) {
        if (attendee.email !== document.people?.creator?.email) {
          participants.push({
            name: attendee.name || 'Unknown',
            email: attendee.email || 'unknown@example.com',
            role: 'Attendee',
            company: attendee.details?.company ? {
              name: attendee.details.company.name,
              domain: attendee.email?.split('@')[1]
            } : undefined
          });
        }
      }
    }
    
    // Detect organization
    const organization = this.organizationDetector.detectOrganization(document);
    
    // Create organization info with confidence
    const organizationInfo: OrganizationInfo = {
      name: organization || 'Unknown',
      confidence: organization ? 0.8 : 0.5, // Simple confidence scoring
      signals: {
        titleMatch: Boolean(organization && document.title?.toLowerCase().includes(organization.toLowerCase())),
        // Add other signals based on actual detection criteria
      }
    };
    
    // Calculate duration if transcript is available
    let duration: number | undefined = undefined;
    if (enhancedTranscript?.segments && enhancedTranscript.segments.length >= 2) {
      const firstSegment = enhancedTranscript.segments[0];
      const lastSegment = enhancedTranscript.segments[enhancedTranscript.segments.length - 1];
      
      if (firstSegment.start_time && lastSegment.end_time) {
        duration = (lastSegment.end_time.getTime() - firstSegment.start_time.getTime()) / 1000;
      }
    }
    
    // Ensure JoshTemplate is always present with empty strings for missing values
    const defaultJoshTemplate: JoshTemplateContent = {
      introduction: "",
      agendaItems: "",
      keyDecisions: "",
      actionItems: "",
      meetingNarrative: "",
      otherNotes: ""
    };
    
    const normalizedJoshTemplate = joshTemplateContent ? {
      introduction: joshTemplateContent.introduction || "",
      agendaItems: joshTemplateContent.agendaItems || "",
      keyDecisions: joshTemplateContent.keyDecisions || "",
      actionItems: joshTemplateContent.actionItems || "",
      meetingNarrative: joshTemplateContent.meetingNarrative || "",
      otherNotes: joshTemplateContent.otherNotes || ""
    } : defaultJoshTemplate;

    // Build the complete payload
    return {
      meetingId: document.document_id || document.id || '',
      meetingTitle: document.title || 'Untitled Meeting',
      meetingDate: document.created_at || new Date().toISOString(),
      metadata: {
        participants,
        duration,
        organization: organizationInfo,
        creator: document.people?.creator ? {
          name: document.people.creator.name,
          email: document.people.creator.email,
          company: document.people.creator.details?.company?.name
        } : undefined
      },
      joshTemplate: normalizedJoshTemplate,
      transcriptMarkdown: transcriptMarkdown || "",
      enhancedTranscript,
      processingTimestamp: new Date().toISOString()
    };
  }
  
  /**
   * Send payload to webhook with retry logic.
   * @param payload The payload to send
   * @returns Result of the webhook delivery
   * @private
   */
  private async sendToWebhook(payload: MeetingPayload): Promise<WebhookResult> {
    if (!this.webhookConfig) {
      return {
        success: false,
        error: "No webhook configuration set"
      };
    }
    
    const maxRetries = this.webhookConfig.maxRetries || 3;
    const retryStrategy = this.webhookConfig.retryStrategy || 'linear';
    const retryDelay = this.webhookConfig.retryDelay || 1000;
    
    let retries = 0;
    let lastError: any;
    
    while (retries <= maxRetries) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...this.webhookConfig.headers || {}
        };
        
        // Add signature if secret is provided
        if (this.webhookConfig.secret) {
          headers['X-Webhook-Signature'] = this.generateSignature(
            JSON.stringify(payload),
            this.webhookConfig.secret
          );
        }
        
        // Send to webhook
        const response = await fetch(this.webhookConfig.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
        
        // Check if successful
        if (response.ok) {
          return {
            success: true,
            statusCode: response.status,
            response: await response.text(),
            retries
          };
        }
        
        // Handle non-200 responses
        lastError = `HTTP error: ${response.status} ${response.statusText}`;
        const responseText = await response.text();
        console.error(`Webhook delivery failed (attempt ${retries+1}/${maxRetries+1}): ${lastError}`, responseText);
      } catch (error) {
        lastError = (error as Error).message;
        console.error(`Webhook request failed (attempt ${retries+1}/${maxRetries+1}):`, error);
      }
      
      // Retry with backoff
      retries++;
      if (retries <= maxRetries) {
        const delay = retryStrategy === 'exponential' 
          ? retryDelay * Math.pow(2, retries - 1) 
          : retryDelay * retries;
          
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // All retries failed
    return {
      success: false,
      error: lastError,
      retries
    };
  }
  
  /**
   * Generate HMAC signature for payload.
   * @param payload The string payload to sign
   * @param secret The secret key for signing
   * @returns Hex-encoded signature
   * @private
   */
  private generateSignature(payload: string, secret: string): string {
    // Use native crypto if available
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      return this.generateBrowserSignature(payload, secret);
    }
    
    // Use Node.js crypto module
    try {
      const crypto = require('crypto');
      return crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
    } catch (error) {
      console.error('Error generating signature:', error);
      throw new Error('Failed to generate webhook signature');
    }
  }
  
  /**
   * Generate signature using Web Crypto API.
   * @param payload The string payload to sign
   * @param secret The secret key for signing
   * @returns Hex-encoded signature
   * @private
   */
  private async generateBrowserSignature(payload: string, secret: string): Promise<string> {
    try {
      // Encode payload and secret
      const encoder = new TextEncoder();
      const payloadBuffer = encoder.encode(payload);
      const secretBuffer = encoder.encode(secret);
      
      // Import secret key
      const key = await crypto.subtle.importKey(
        'raw', 
        secretBuffer,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      // Sign payload
      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        payloadBuffer
      );
      
      // Convert to hex
      return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (error) {
      console.error('Error generating browser signature:', error);
      throw new Error('Failed to generate webhook signature');
    }
  }
  
  /**
   * Process all unprocessed meetings since a specific date.
   * @param since Date to start processing from
   * @param processedIds Set of already processed document IDs
   * @param limit Maximum number of documents to process
   * @returns Array of processing results
   */
  public async processUnprocessedMeetings(
    since?: Date, 
    processedIds: Set<string> = new Set(), 
    limit: number = 20
  ): Promise<WebhookResult[]> {
    // Get recent documents
    const documents = await this.getDocuments({ limit });
    if (!documents.docs || documents.docs.length === 0) {
      return [];
    }
    
    // Filter to recent, unprocessed documents
    const unprocessedDocs = documents.docs.filter(doc => {
      // Filter by date if provided
      if (since) {
        const docDate = new Date(doc.created_at || '');
        if (docDate < since) return false;
      }
      
      // Filter out already processed documents
      return !processedIds.has(doc.document_id || doc.id || '');
    });
    
    // Process each document
    const results: WebhookResult[] = [];
    for (const doc of unprocessedDocs) {
      const documentId = doc.document_id || doc.id;
      if (!documentId) continue;
      
      console.log(`Processing meeting: ${doc.title} (${documentId})`);
      const result = await this.processMeeting(documentId);
      results.push(result);
      
      // Add to processed set regardless of success
      processedIds.add(documentId);
    }
    
    return results;
  }
}