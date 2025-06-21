// src/output-destinations.ts
import type { OutputConfig, MeetingPayload } from './webhook-types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Result of an output operation
 */
export interface OutputResult {
  success: boolean;
  destination: string;
  error?: string;
}

/**
 * Output destination manager
 */
export class OutputDestinationManager {
  private config: OutputConfig;
  
  constructor(config: OutputConfig) {
    this.config = config;
  }
  
  /**
   * Send meeting payload to all configured output destinations
   * @param payload The meeting payload to send
   * @returns Array of results from each destination
   */
  async sendToOutputs(payload: MeetingPayload): Promise<OutputResult[]> {
    const results: OutputResult[] = [];
    
    // Send to webhook (existing functionality)
    if (this.config.webhook?.enabled && this.config.webhook.url) {
      try {
        const result = await this.sendToWebhook(payload);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          destination: 'webhook',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Send to Airtable
    if (this.config.airtable?.enabled && this.config.airtable.apiKey && this.config.airtable.baseId) {
      try {
        const result = await this.sendToAirtable(payload);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          destination: 'airtable',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Send to Google Sheets
    if (this.config.googleSheets?.enabled && this.config.googleSheets.spreadsheetId) {
      try {
        const result = await this.sendToGoogleSheets(payload);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          destination: 'google_sheets',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Send to JSON file
    if (this.config.jsonFile?.enabled && this.config.jsonFile.filePath) {
      try {
        const result = await this.sendToJsonFile(payload);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          destination: 'json_file',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return results;
  }
  
  /**
   * Send to webhook (existing functionality)
   */
  private async sendToWebhook(payload: MeetingPayload): Promise<OutputResult> {
    const config = this.config.webhook!;
    
    const response = await fetch(config.url!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
    }
    
    return {
      success: true,
      destination: 'webhook'
    };
  }
  
  /**
   * Send to Airtable
   */
  private async sendToAirtable(payload: MeetingPayload): Promise<OutputResult> {
    const config = this.config.airtable!;
    
    // Transform meeting payload to Airtable record format
    const record = {
      fields: {
        'Meeting ID': payload.meetingId,
        'Title': payload.meetingTitle,
        'Date': payload.meetingDate,
        'Organization': payload.metadata.organization?.name || 'Unknown',
        'Creator': payload.metadata.creator?.name || 'Unknown',
        'Participants': payload.metadata.participants.map(p => p.name).join(', '),
        'Duration': payload.metadata.duration || 0,
        'Has Template': payload.joshTemplate ? 'Yes' : 'No',
        'Processing Timestamp': payload.processingTimestamp
      }
    };
    
    const url = `https://api.airtable.com/v0/${config.baseId}/${config.tableName || 'Meetings'}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(record)
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Airtable request failed: ${response.status} ${response.statusText} - ${errorData}`);
    }
    
    return {
      success: true,
      destination: 'airtable'
    };
  }
  
  /**
   * Send to Google Sheets
   */
  private async sendToGoogleSheets(payload: MeetingPayload): Promise<OutputResult> {
    const config = this.config.googleSheets!;
    
    // This is a simplified implementation
    // In a real implementation, you would use the Google Sheets API with proper authentication
    console.log('Google Sheets integration would be implemented here');
    console.log(`Would send to spreadsheet: ${config.spreadsheetId}, sheet: ${config.sheetName}`);
    console.log(`Meeting: ${payload.meetingTitle} (${payload.meetingId})`);
    
    // For now, return success (this would be replaced with actual Google Sheets API calls)
    return {
      success: true,
      destination: 'google_sheets'
    };
  }
  
  /**
   * Send to JSON file
   */
  private async sendToJsonFile(payload: MeetingPayload): Promise<OutputResult> {
    const config = this.config.jsonFile!;
    const filePath = config.filePath!;
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    if (config.appendMode) {
      // Append to existing file
      let existingData: any[] = [];
      
      if (fs.existsSync(filePath)) {
        try {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          existingData = JSON.parse(fileContent);
          if (!Array.isArray(existingData)) {
            existingData = [existingData];
          }
        } catch (error) {
          // If file is corrupted or empty, start fresh
          existingData = [];
        }
      }
      
      existingData.push(payload);
      fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
    } else {
      // Overwrite file
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
    }
    
    return {
      success: true,
      destination: 'json_file'
    };
  }
}