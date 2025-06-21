// test/state-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { StateManager } from '../src/state/state-manager';
import { createLogger } from '../src/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

describe('StateManager', () => {
  let logger: any;
  let tempStateFile: string;

  beforeEach(() => {
    logger = createLogger('test');
    tempStateFile = path.join('/tmp', `test-state-${Date.now()}.json`);
  });

  afterEach(() => {
    // Clean up temp file
    if (fs.existsSync(tempStateFile)) {
      fs.unlinkSync(tempStateFile);
    }
  });

  it('should initialize with fresh state when file does not exist', () => {
    const stateManager = new StateManager({
      filePath: tempStateFile,
      lookbackDays: 3
    }, logger);

    const state = stateManager.getState();
    expect(state.processedMeetings).toEqual([]);
    expect(state.skippedMeetings).toEqual([]);
    expect(state.failureTracking).toBeDefined();
    expect(state.failureTracking?.consecutiveFailures).toBe(0);
  });

  it('should track processed meetings', () => {
    const stateManager = new StateManager({
      filePath: tempStateFile,
      lookbackDays: 3
    }, logger);

    expect(stateManager.isProcessed('meeting-1')).toBe(false);

    stateManager.addProcessedMeeting({
      id: 'meeting-1',
      title: 'Test Meeting',
      success: true
    });

    expect(stateManager.isProcessed('meeting-1')).toBe(true);
    
    const processedIds = stateManager.getProcessedIds();
    expect(processedIds.has('meeting-1')).toBe(true);
  });

  it('should handle skip notification logic correctly', () => {
    const stateManager = new StateManager({
      filePath: tempStateFile,
      lookbackDays: 3
    }, logger);

    // First skip should notify
    const shouldNotify1 = stateManager.shouldNotifyForSkipped(
      'meeting-1', 
      'Test Meeting', 
      'missing_template'
    );
    expect(shouldNotify1).toBe(true);

    // Second skip within 24 hours should not notify
    const shouldNotify2 = stateManager.shouldNotifyForSkipped(
      'meeting-1', 
      'Test Meeting', 
      'missing_template'
    );
    expect(shouldNotify2).toBe(false);

    // Third skip should not notify (not multiple of 5)
    const shouldNotify3 = stateManager.shouldNotifyForSkipped(
      'meeting-1', 
      'Test Meeting', 
      'missing_template'
    );
    expect(shouldNotify3).toBe(false);

    // Fifth skip should notify (multiple of 5)
    stateManager.shouldNotifyForSkipped('meeting-1', 'Test Meeting', 'missing_template');
    const shouldNotify5 = stateManager.shouldNotifyForSkipped(
      'meeting-1', 
      'Test Meeting', 
      'missing_template'
    );
    expect(shouldNotify5).toBe(true);
  });

  it('should handle failure tracking correctly', () => {
    const stateManager = new StateManager({
      filePath: tempStateFile,
      lookbackDays: 3
    }, logger);

    // First failure should notify
    const failure1 = stateManager.recordFailure();
    expect(failure1.shouldNotify).toBe(true);
    expect(failure1.count).toBe(1);

    // Second failure should not notify
    const failure2 = stateManager.recordFailure();
    expect(failure2.shouldNotify).toBe(false);
    expect(failure2.count).toBe(2);

    // Third failure should notify (multiple of 3)
    const failure3 = stateManager.recordFailure();
    expect(failure3.shouldNotify).toBe(true);
    expect(failure3.count).toBe(3);

    // Success should reset count
    stateManager.recordSuccess();
    const failure4 = stateManager.recordFailure();
    expect(failure4.shouldNotify).toBe(true);
    expect(failure4.count).toBe(1);
  });

  it('should persist and load state correctly', () => {
    // Create state manager and add some data
    const stateManager1 = new StateManager({
      filePath: tempStateFile,
      lookbackDays: 3
    }, logger);

    stateManager1.addProcessedMeeting({
      id: 'meeting-1',
      title: 'Test Meeting',
      success: true
    });

    stateManager1.shouldNotifyForSkipped('meeting-2', 'Skipped Meeting', 'missing_template');
    stateManager1.save();

    // Create new state manager and verify data persisted
    const stateManager2 = new StateManager({
      filePath: tempStateFile,
      lookbackDays: 3
    }, logger);

    expect(stateManager2.isProcessed('meeting-1')).toBe(true);
    const state = stateManager2.getState();
    expect(state.processedMeetings).toHaveLength(1);
    expect(state.skippedMeetings).toHaveLength(1);
  });

  it('should update timestamps correctly', () => {
    const stateManager = new StateManager({
      filePath: tempStateFile,
      lookbackDays: 3
    }, logger);

    const initialTimestamp = stateManager.getLastCheckTimestamp();
    const initialDate = new Date(initialTimestamp);

    // Wait a bit and update timestamp
    setTimeout(() => {
      stateManager.updateLastCheckTimestamp();
      const newTimestamp = stateManager.getLastCheckTimestamp();
      const newDate = new Date(newTimestamp);
      
      expect(newDate.getTime()).toBeGreaterThan(initialDate.getTime());
    }, 10);
  });
});