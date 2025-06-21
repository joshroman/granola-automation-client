// src/utils/error-handler.ts
import type { Logger } from 'pino';

/**
 * Sets up global error handlers for the process
 * @param logger Logger instance for error reporting
 * @param onExit Optional callback to run before exit (e.g., save state)
 */
export function setupErrorHandlers(logger: Logger, onExit?: () => Promise<void> | void): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    logger.fatal({ error }, 'Uncaught exception - shutting down');
    
    try {
      if (onExit) {
        await onExit();
      }
    } catch (exitError) {
      logger.error({ error: exitError }, 'Error during shutdown');
    }
    
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    logger.fatal({ reason, promise }, 'Unhandled promise rejection - shutting down');
    
    try {
      if (onExit) {
        await onExit();
      }
    } catch (exitError) {
      logger.error({ error: exitError }, 'Error during shutdown');
    }
    
    process.exit(1);
  });

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT - shutting down gracefully');
    
    try {
      if (onExit) {
        await onExit();
      }
    } catch (exitError) {
      logger.error({ error: exitError }, 'Error during shutdown');
    }
    
    process.exit(0);
  });

  // Handle SIGTERM
  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM - shutting down gracefully');
    
    try {
      if (onExit) {
        await onExit();
      }
    } catch (exitError) {
      logger.error({ error: exitError }, 'Error during shutdown');
    }
    
    process.exit(0);
  });

  logger.debug('Error handlers initialized');
}