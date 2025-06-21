// src/webhook-client.ts
import { PanelClient } from './panel-client';
import { TranscriptClient } from './transcript-client';
import { 
  OrganizationDetector, 
  type OrganizationDetectorConfig,
  type OrganizationConfig 
} from './organization-detector';
import type { 
  WebhookConfig, 
  MeetingPayload, 
  MeetingParticipant, 
  WebhookResult,
  OrganizationInfo,
  JoshTemplateContent,
  EnhancedTranscript,
  TemplateValidationConfig
} from './webhook-types';
import type { components } from './schema';

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
  private templateValidationConfig: TemplateValidationConfig | null = null;
  
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
   * Set the template validation configuration.
   * @param config The template validation configuration to use
   */
  public setTemplateValidationConfig(config: TemplateValidationConfig): void {
    this.templateValidationConfig = config;
  }
  
  /**
   * Set the Josh Template ID (legacy method for backwards compatibility).
   * @param templateId The ID of the Josh Template to look for
   * @deprecated Use setTemplateValidationConfig instead
   */
  public setJoshTemplateId(templateId: string): void {
    // Create a default template validation config for backwards compatibility
    this.templateValidationConfig = {
      enabled: true,
      mode: 'specific',
      requiredTemplateIds: [templateId],
      templateNames: {
        [templateId]: 'Josh Template'
      }
    };
  }
  
  /**
   * Set the organization detector.
   * @param detector The organization detector to use
   */
  public setOrganizationDetector(detector: OrganizationDetector): void {
    this.organizationDetector = detector;
  }
  
  /**
   * Validate templates for a meeting based on configuration
   * @param panels The panels from the meeting
   * @param meetingTitle The title of the meeting
   * @returns Validation result with skip information and matched panel
   */
  private validateTemplates(panels: any[], meetingTitle: string): {
    shouldSkip: boolean;
    result?: WebhookResult;
    matchedPanel?: any;
  } {
    // If no template validation config, allow processing
    if (!this.templateValidationConfig || !this.templateValidationConfig.enabled) {
      return { shouldSkip: false };
    }
    
    const config = this.templateValidationConfig;
    
    // Find matching panels
    const matchingPanels = panels.filter(panel => 
      config.requiredTemplateIds.includes(panel.template_slug)
    );
    
    // Check validation mode
    switch (config.mode) {
      case 'disabled':
        return { shouldSkip: false };
        
      case 'any':
        if (matchingPanels.length === 0) {
          // No required templates found
          const templateNames = config.requiredTemplateIds
            .map(id => config.templateNames[id] || id)
            .join(', ');
          
          console.log(`Skipping meeting "${meetingTitle}" - Required template(s) not found: ${templateNames}`);
          return {
            shouldSkip: true,
            result: {
              success: false,
              skipped: true,
              skipReason: 'missing_required_template',
              error: `Meeting skipped: Required template(s) not applied to "${meetingTitle}". Required: ${templateNames}`
            }
          };
        }
        return { shouldSkip: false, matchedPanel: matchingPanels[0] };
        
      case 'specific':
        // For backwards compatibility with Josh Template
        if (matchingPanels.length === 0) {
          const templateNames = config.requiredTemplateIds
            .map(id => config.templateNames[id] || id)
            .join(', ');
          
          console.log(`Skipping meeting "${meetingTitle}" - Required template(s) not found: ${templateNames}`);
          return {
            shouldSkip: true,
            result: {
              success: false,
              skipped: true,
              skipReason: 'missing_required_template',
              error: `Meeting skipped: Required template(s) not applied to "${meetingTitle}". Required: ${templateNames}`
            }
          };
        }
        return { shouldSkip: false, matchedPanel: matchingPanels[0] };
        
      default:
        return { shouldSkip: false };
    }
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
      
      // 3. Perform template validation if configured
      const templateValidationResult = this.validateTemplates(panels, document.title);
      if (templateValidationResult.shouldSkip) {
        return templateValidationResult.result;
      }
      
      // 4. Extract template content (backwards compatibility for Josh Template)
      let joshTemplateContent: JoshTemplateContent | undefined;
      const templatePanel = templateValidationResult.matchedPanel;
      if (templatePanel) {
        const sections = this.extractStructuredContent(templatePanel);
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
          created_at: metadata.created_at || new Date().toISOString(), // Use metadata date when available
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

    // Ensure meetingDate is properly formatted and uses the original date from the document
    let meetingDate = new Date().toISOString();
    if (document.created_at) {
      try {
        // Log the raw date from document for debugging
        console.log(`Raw document created_at: ${document.created_at}`);
        
        // Parse the meeting date from the document's created_at
        const createdDate = new Date(document.created_at);
        
        // Check if it's a valid date
        if (!isNaN(createdDate.getTime())) {
          meetingDate = document.created_at; // Use the original string to avoid timezone issues
          console.log(`Using meeting date: ${meetingDate}`);
        } else {
          console.warn(`Invalid date detected: ${document.created_at}, using current time instead`);
        }
      } catch (e) {
        console.error(`Error parsing meeting date: ${e}`);
      }
    }

    // Build the complete payload
    return {
      meetingId: document.document_id || document.id || '',
      meetingTitle: document.title || 'Untitled Meeting',
      meetingDate: meetingDate,
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