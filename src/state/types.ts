// src/state/types.ts

/**
 * Represents a processed meeting record
 */
export interface ProcessedMeeting {
  id: string;
  title: string;
  processed_at: string;
  success: boolean;
}

/**
 * Represents a skipped meeting record
 */
export interface SkippedMeeting {
  id: string;
  title: string;
  skipReason: string;
  last_notified_at: string;
  skip_count: number;
}

/**
 * Failure tracking information
 */
export interface FailureTracking {
  consecutiveFailures: number;
  lastNotificationTime: string | null;
  lastSuccessTime: string;
}

/**
 * Complete monitor state
 */
export interface MonitorState {
  lastCheckTimestamp: string;
  processedMeetings: ProcessedMeeting[];
  skippedMeetings?: SkippedMeeting[];
  failureTracking?: FailureTracking;
}

/**
 * Options for StateManager
 */
export interface StateManagerOptions {
  filePath: string;
  lookbackDays: number;
}