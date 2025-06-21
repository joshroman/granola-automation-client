// examples/webhook-monitor.ts
import { 
  WebhookClient, 
  OrganizationDetector,
  NotificationManager,
  StateManager,
  ConfigLoader,
  OutputDestinationManager,
  createLogger,
  setupErrorHandlers,
  type WebhookConfig,
  type WebhookResult
} from '../src';

/**
 * Main class for monitoring meetings and processing them through webhooks
 */
class MeetingMonitor {
  private client: WebhookClient;
  private stateManager: StateManager;
  private notificationManager: NotificationManager;
  private outputManager: OutputDestinationManager;
  private config: any; // Will be typed by ConfigLoader
  private logger: any; // pino Logger

  constructor(configPath: string) {
    // Initialize logger
    this.logger = createLogger('webhook-monitor');
    
    // Load and validate configuration
    const configLoader = new ConfigLoader(this.logger);
    this.config = configLoader.load(configPath);
    
    // Initialize state manager
    this.stateManager = new StateManager({
      filePath: this.config.monitoring.stateFilePath,
      lookbackDays: this.config.monitoring.lookbackDays
    }, this.logger);
    
    // Setup error handlers with state saving
    setupErrorHandlers(this.logger, () => {
      this.logger.info('Saving state before shutdown');
      this.stateManager.save();
    });
    
    // Initialize notification manager
    this.notificationManager = new NotificationManager(
      this.config.notifications,
      { logger: this.logger }
    );
    
    // Initialize output manager
    this.outputManager = new OutputDestinationManager(this.config.outputs);
    
    // Initialize webhook client
    this.client = new WebhookClient();
    
    // Configure webhook client
    const activeEnv = this.config.webhook.activeEnvironment;
    const environment = this.config.environments[activeEnv];
    
    if (!environment) {
      throw new Error(`Environment '${activeEnv}' not found in configuration`);
    }
    
    const webhookConfig: WebhookConfig = {
      ...this.config.webhook,
      url: environment.url,
      headers: environment.headers
    };
    
    this.client.setWebhookConfig(webhookConfig);
    
    // Set organization detector
    this.client.setOrganizationDetector(new OrganizationDetector({
      organizations: this.config.organizations,
      defaultOrganization: this.config.defaultOrganization
    }));
    
    // Set template validation
    if (this.config.templateValidation) {
      this.client.setTemplateValidationConfig(this.config.templateValidation);
    }
    
    this.logger.info('Meeting monitor initialized', {
      environment: activeEnv,
      webhookUrl: environment.url,
      notificationChannels: this.notificationManager.getEnabledChannels()
    });
  }

  /**
   * Process a specific meeting by ID
   */
  async processMeeting(meetingId: string): Promise<void> {
    this.logger.info(`Processing specific meeting: ${meetingId}`);
    
    try {
      const result = await this.client.processMeeting(meetingId);
      
      // Get meeting details
      const docs = await this.client.getDocuments({ limit: 100 });
      const doc = docs.docs?.find(d => (d.document_id || d.id) === meetingId);
      const meetingTitle = doc?.title || 'Unknown';
      
      await this.handleMeetingResult(meetingId, meetingTitle, result);
    } catch (error) {
      await this.handleError(error);
      throw error;
    } finally {
      this.stateManager.save();
    }
  }

  /**
   * Process all unprocessed meetings within the lookback period
   */
  async processUnprocessedMeetings(): Promise<void> {
    const lastCheck = this.stateManager.getLastCheckTimestamp();
    const processedIds = this.stateManager.getProcessedIds();
    
    this.logger.info(`Looking for unprocessed meetings since ${new Date(lastCheck).toLocaleString()}`);
    
    try {
      const results = await this.client.processUnprocessedMeetings(
        new Date(lastCheck),
        processedIds,
        this.config.monitoring.maxMeetingsPerRun
      );
      
      if (results.length === 0) {
        this.logger.info('No new meetings to process');
        return;
      }
      
      this.logger.info(`Processing ${results.length} meetings`);
      
      // Get documents for meeting titles
      const docs = await this.client.getDocuments({ limit: 100 });
      const docsMap = new Map();
      if (docs.docs) {
        for (const doc of docs.docs) {
          docsMap.set(doc.document_id || doc.id, doc);
        }
      }
      
      // Process each result
      const processedIdsArray = Array.from(processedIds);
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const meetingId = processedIdsArray[processedIds.size - results.length + i];
        const doc = docsMap.get(meetingId);
        const meetingTitle = doc?.title || 'Unknown';
        
        await this.handleMeetingResult(meetingId, meetingTitle, result);
      }
      
      // Update timestamp and record success
      this.stateManager.updateLastCheckTimestamp();
      this.stateManager.recordSuccess();
      
    } catch (error) {
      await this.handleError(error);
      throw error;
    } finally {
      this.stateManager.save();
    }
  }

  /**
   * Handle the result of processing a single meeting
   */
  private async handleMeetingResult(
    meetingId: string, 
    meetingTitle: string, 
    result: WebhookResult
  ): Promise<void> {
    if (result.success) {
      // Success
      this.logger.info(`Successfully processed meeting: ${meetingTitle}`, { meetingId });
      
      await this.notificationManager.send(
        `✅ Success: processed "${meetingTitle}"`,
        this.formatSuccessBody(meetingTitle, meetingId)
      );
      
      this.stateManager.addProcessedMeeting({
        id: meetingId,
        title: meetingTitle,
        success: true
      });
      
    } else if (result.skipped && result.skipReason === 'missing_required_template') {
      // Skipped due to missing template
      const shouldNotify = this.stateManager.shouldNotifyForSkipped(
        meetingId, 
        meetingTitle, 
        result.skipReason
      );
      
      if (shouldNotify) {
        const templateNames = result.error?.match(/Required: (.+)$/)?.[1] || 'Unknown templates';
        
        await this.notificationManager.send(
          '🟡 Required Template Missing',
          this.formatTemplateValidationBody(meetingTitle, meetingId, templateNames),
          true // Include desktop notification
        );
      }
      
      this.logger.info(`Meeting skipped due to missing template`, {
        meetingId,
        meetingTitle,
        notificationSent: shouldNotify
      });
      
    } else {
      // Failure
      this.logger.error(`Failed to process meeting: ${meetingTitle}`, {
        meetingId,
        error: result.error
      });
      
      await this.notificationManager.send(
        `🔴 ERROR: Failed to process "${meetingTitle}"`,
        this.formatFailureBody(meetingTitle, meetingId)
      );
      
      this.stateManager.addProcessedMeeting({
        id: meetingId,
        title: meetingTitle,
        success: false
      });
    }
  }

  /**
   * Handle errors and send notifications
   */
  private async handleError(error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error('Error monitoring meetings', { error: errorMessage });
    
    const { shouldNotify, count } = this.stateManager.recordFailure();
    
    if (shouldNotify) {
      const failureTracking = this.stateManager.getFailureTracking();
      
      await this.notificationManager.send(
        `🔴 ERROR IN GRANOLA PROCESSING (${count} consecutive failures)`,
        this.formatErrorBody(errorMessage, count, failureTracking?.lastSuccessTime)
      );
    }
  }

  /**
   * Format notification bodies
   */
  private formatSuccessBody(meetingTitle: string, meetingId: string): string {
    return `Successfully processed meeting:
- Title: ${meetingTitle}
- ID: ${meetingId}
- Time: ${new Date().toLocaleString()}
- Environment: ${this.config.webhook.activeEnvironment}`;
  }

  private formatTemplateValidationBody(meetingTitle: string, meetingId: string, templateNames: string): string {
    return `*REQUIRED TEMPLATE MISSING*

Meeting requires template(s) but none were found:
- Title: ${meetingTitle}
- ID: ${meetingId}
- Environment: ${this.config.webhook.activeEnvironment}
- Time: ${new Date().toLocaleString()}
- Required: ${templateNames}

Please apply the required template(s) in Granola and the meeting will be processed in the next cron run.`;
  }

  private formatFailureBody(meetingTitle: string, meetingId: string): string {
    return `*MEETING PROCESSING ERROR*

Failed to process meeting:
- Title: ${meetingTitle}
- ID: ${meetingId}
- Time: ${new Date().toLocaleString()}
- Environment: ${this.config.webhook.activeEnvironment}

Please check the logs for detailed error information.`;
  }

  private formatErrorBody(errorMessage: string, failureCount: number, lastSuccess?: string): string {
    return `*ERROR IN GRANOLA PROCESSING*

Granola webhook monitor encountered an error at ${new Date().toLocaleString()}

Error: ${errorMessage}

Environment: ${this.config.webhook.activeEnvironment}
Configuration: ${this.config.monitoring.stateFilePath}
Consecutive failures: ${failureCount}
Last success: ${lastSuccess || 'Unknown'}

This could indicate that the Granola API has changed, or there are network/authentication issues.
Please check the logs for more details.`;
  }
}

/**
 * CLI entry point
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let configPath = './webhook-config.private.json';
  let environment: string | undefined;
  let meetingId: string | undefined;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' || args[i] === '-c') {
      configPath = args[i + 1];
      i++;
    } else if (args[i] === '--env' || args[i] === '-e') {
      environment = args[i + 1];
      i++;
    } else if (args[i] === '--meeting' || args[i] === '-m') {
      meetingId = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: webhook-monitor.ts [options]

Options:
  --config, -c <path>   Path to webhook configuration file (default: ./webhook-config.private.json)
  --env, -e <env>       Environment to use (test or production)
  --meeting, -m <id>    Process a specific meeting by ID
  --help, -h            Show this help message
      `);
      process.exit(0);
    } else if (!args[i].startsWith('-') && i === 0) {
      // For backward compatibility
      configPath = args[i];
    }
  }
  
  // Override environment if specified
  if (environment) {
    process.env.WEBHOOK_ENVIRONMENT = environment;
  }
  
  try {
    const monitor = new MeetingMonitor(configPath);
    
    if (meetingId) {
      await monitor.processMeeting(meetingId);
    } else {
      await monitor.processUnprocessedMeetings();
    }
    
    console.log('\nMonitoring complete.');
  } catch (error) {
    console.error('\nError running monitor:', error);
    process.exit(1);
  }
}

// Legacy function exports for backwards compatibility
export { MeetingMonitor as monitorMeetings };
export { MeetingMonitor as monitorMeetingsWithEnv };

// Run if called directly
if (require.main === module) {
  main();
}