import { initExifRemover } from './exifRemover';

/**
 * Initialize all app modules
 */
export async function initializeApp(): Promise<void> {
  const initTasks: Promise<void>[] = [];
  
  initTasks.push(
    initExifRemover().catch((error) => {
      console.warn('Failed to initialize EXIF remover, feature will be disabled:', error);
    })
  );
  
  await Promise.all(initTasks);
}
