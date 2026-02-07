let shuttingDown = false;

export function isShuttingDown() {
  return shuttingDown;
}

export function initShutdown(handler) {
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log('\nGraceful shutdown started...');

    try {
      await handler();
      console.log('Cleanup done. Exiting.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
