// src/state/state-manager.ts
import * as fs from 'fs';
import * as path from 'path';
import type { Logger } from 'pino';
import type { 
  MonitorState, 
  ProcessedMeeting, 
  SkippedMeeting, 
  FailureTracking,
  StateManagerOptions 
} from './types';

/**
 * Manages persistent state for the webhook monitor
 */
export class StateManager {
  private state: MonitorState;
  private filePath: string;
  private logger: Logger;

  constructor(options: StateManagerOptions, logger: Logger) {
    this.filePath = options.filePath;
    this.logger = logger.child({ component: 'StateManager' });
    
    this.ensureStateDirectory();
    this.state = this.loadOrInitialize(options.lookbackDays);
  }

  /**
   * Ensures the directory for the state file exists
   */
  private ensureStateDirectory(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      this.logger.info(`Created state directory: ${dir}`);
    }
  }

  /**
   * Loads state from file or initializes a new state
   */
  private loadOrInitialize(lookbackDays: number): MonitorState {
    try {
      if (fs.existsSync(this.filePath)) {
        const stateData = fs.readFileSync(this.filePath, 'utf8');
        const state = JSON.parse(stateData) as MonitorState;
        
        // Ensure all required fields exist
        if (!state.skippedMeetings) state.skippedMeetings = [];
        if (!state.failureTracking) {
          state.failureTracking = {
            consecutiveFailures: 0,
            lastNotificationTime: null,
            lastSuccessTime: new Date().toISOString()
          };
        }
        
        this.logger.info('Loaded existing state', {
          processedMeetings: state.processedMeetings.length,
          skippedMeetings: state.skippedMeetings.length
        });
        
        return state;
      }
    } catch (error) {
      this.logger.error({ error }, 'Error loading state file, initializing fresh state');
    }

    // Initialize new state
    const newState: MonitorState = {
      lastCheckTimestamp: new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString(),
      processedMeetings: [],
      skippedMeetings: [],
      failureTracking: {
        consecutiveFailures: 0,
        lastNotificationTime: null,
        lastSuccessTime: new Date().toISOString()
      }
    };

    this.logger.info('Initialized new state', { lookbackDays });
    return newState;
  }

  /**
   * Saves the current state to file atomically
   */
  save(): void {
    try {
      const tempPath = `${this.filePath}.tmp`;
      const data = JSON.stringify(this.state, null, 2);
      
      // Write to temp file first
      fs.writeFileSync(tempPath, data);
      
      // Atomic rename
      fs.renameSync(tempPath, this.filePath);
      
      this.logger.debug('State saved successfully');
    } catch (error) {
      this.logger.error({ error }, 'Failed to save state');
      throw error;
    }
  }

  /**
   * Gets the last check timestamp
   */
  getLastCheckTimestamp(): string {
    return this.state.lastCheckTimestamp;
  }

  /**
   * Updates the last check timestamp to now
   */
  updateLastCheckTimestamp(): void {
    this.state.lastCheckTimestamp = new Date().toISOString();
  }

  /**
   * Checks if a meeting has been processed
   */
  isProcessed(meetingId: string): boolean {
    return this.state.processedMeetings.some(m => m.id === meetingId);
  }

  /**
   * Gets a set of all processed meeting IDs
   */
  getProcessedIds(): Set<string> {
    return new Set(this.state.processedMeetings.map(m => m.id));
  }

  /**
   * Adds a processed meeting record
   */
  addProcessedMeeting(meeting: Omit<ProcessedMeeting, 'processed_at'>): void {
    this.state.processedMeetings.push({
      ...meeting,
      processed_at: new Date().toISOString()
    });
    this.logger.debug(`Added processed meeting: ${meeting.id}`);
  }

  /**
   * Determines if a notification should be sent for a skipped meeting
   * @returns true if notification should be sent
   */
  shouldNotifyForSkipped(meetingId: string, meetingTitle: string, skipReason: string): boolean {
    if (!this.state.skippedMeetings) {
      this.state.skippedMeetings = [];
    }

    const existingSkipped = this.state.skippedMeetings.find(sm => sm.id === meetingId);

    if (existingSkipped) {
      // Update existing record
      existingSkipped.skip_count += 1;
      existingSkipped.title = meetingTitle; // Update in case title changed

      // Check if we should send notification
      const lastNotified = new Date(existingSkipped.last_notified_at);
      const now = new Date();
      const hoursSinceLastNotification = (now.getTime() - lastNotified.getTime()) / (1000 * 60 * 60);

      // Notify every 5 skips or if more than 24 hours since last notification
      const shouldNotify = existingSkipped.skip_count % 5 === 0 || hoursSinceLastNotification >= 24;

      if (shouldNotify) {
        existingSkipped.last_notified_at = now.toISOString();
      }

      this.logger.debug(`Skip notification decision for ${meetingId}`, {
        skipCount: existingSkipped.skip_count,
        hoursSinceLastNotification,
        shouldNotify
      });

      return shouldNotify;
    } else {
      // Add new skipped meeting record
      this.state.skippedMeetings.push({
        id: meetingId,
        title: meetingTitle,
        skipReason: skipReason,
        last_notified_at: new Date().toISOString(),
        skip_count: 1
      });

      this.logger.debug(`First skip for meeting ${meetingId}, will notify`);
      return true; // Always notify for first time
    }
  }

  /**
   * Records a successful run
   */
  recordSuccess(): void {
    if (!this.state.failureTracking) {
      this.state.failureTracking = {
        consecutiveFailures: 0,
        lastNotificationTime: null,
        lastSuccessTime: new Date().toISOString()
      };
    }

    const previousFailures = this.state.failureTracking.consecutiveFailures;
    this.state.failureTracking.consecutiveFailures = 0;
    this.state.failureTracking.lastSuccessTime = new Date().toISOString();

    if (previousFailures > 0) {
      this.logger.info(`Recovered from ${previousFailures} consecutive failures`);
    }
  }

  /**
   * Records a failed run and determines if notification should be sent
   * @returns Object with shouldNotify flag and failure count
   */
  recordFailure(): { shouldNotify: boolean; count: number; previousFailures: number } {
    if (!this.state.failureTracking) {
      this.state.failureTracking = {
        consecutiveFailures: 0,
        lastNotificationTime: null,
        lastSuccessTime: new Date().toISOString()
      };
    }

    const previousFailures = this.state.failureTracking.consecutiveFailures;
    this.state.failureTracking.consecutiveFailures++;

    // Notify on first failure or every 3 failures
    const shouldNotify = 
      this.state.failureTracking.consecutiveFailures === 1 || 
      this.state.failureTracking.consecutiveFailures % 3 === 0;

    if (shouldNotify) {
      this.state.failureTracking.lastNotificationTime = new Date().toISOString();
    }

    this.logger.warn(`Recorded failure #${this.state.failureTracking.consecutiveFailures}`, {
      shouldNotify,
      lastSuccess: this.state.failureTracking.lastSuccessTime
    });

    return {
      shouldNotify,
      count: this.state.failureTracking.consecutiveFailures,
      previousFailures
    };
  }

  /**
   * Gets failure tracking information
   */
  getFailureTracking(): FailureTracking | undefined {
    return this.state.failureTracking;
  }

  /**
   * Gets the complete state (for debugging/testing)
   */
  getState(): Readonly<MonitorState> {
    return this.state;
  }
}