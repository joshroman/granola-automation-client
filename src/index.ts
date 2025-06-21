// src/index.ts
export * from './client';
export { default } from './client';
export * from './http';
export * from './pagination';
export * from './transcript-types';
export { TranscriptClient } from './transcript-client';
export * from './panel-types';
export { PanelClient } from './panel-client';
export * from './organization-detector';
export * from './webhook-types';
export { WebhookClient } from './webhook-client';
export * from './output-destinations';

// Export notification system
export * from './notifications/types';
export { NotificationManager } from './notifications/notification-manager';

// Export state management
export * from './state/types';
export { StateManager } from './state/state-manager';

// Export config management
export * from './config/config-schema';
export { ConfigLoader } from './config/config-loader';

// Export utilities
export { createLogger, getLogger, rootLogger } from './utils/logger';
export { setupErrorHandlers } from './utils/error-handler';

// Re-export schema types
export type { components, paths } from './schema.d.ts';