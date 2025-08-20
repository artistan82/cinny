import init, { remove_exif_data, is_file_supported, type InitOutput } from '@/wasm/exif-remover-wasm/exif_remover_wasm.js';

let wasmModule: InitOutput | null = null;
let wasmInitPromise: Promise<InitOutput> | null = null;

let removeExifDataFn: typeof remove_exif_data | null = null;
let isFileSupportedFn: typeof is_file_supported | null = null;

/**
 * Initialize the EXIF Remover WebAssembly module
 */
export async function initExifRemover(): Promise<void> {
  if (wasmModule) return;

  if (wasmInitPromise) {
    await wasmInitPromise;
    return;
  }

  wasmInitPromise = (async () => {
    try {
      const wasm = await init();
      removeExifDataFn = remove_exif_data;
      isFileSupportedFn = is_file_supported;
      return wasm;
    } catch (error) {
      console.error('Failed to initialize EXIF Remover WASM module:', error);
      throw error;
    }
  })();

  wasmModule = await wasmInitPromise;
}

/**
 * Check if a file is supported for EXIF removal
 */
export function isExifRemovalSupported(data: Uint8Array): boolean {
  if (!isFileSupportedFn) {
    console.warn('EXIF Remover WASM module not initialized');
    return false;
  }

  try {
    return isFileSupportedFn(data);
  } catch (error) {
    console.error('Error checking file support:', error);
    return false;
  }
}

/**
 * Remove EXIF data from an image file
 */
export function removeExifData(data: Uint8Array): Uint8Array {
  if (!removeExifDataFn) {
    console.warn('EXIF Remover WASM module not initialized, returning original data');
    return data;
  }

  try {
    return removeExifDataFn(data);
  } catch (error) {
    console.error('Error removing EXIF data:', error);
    return data;
  }
}

/**
 * Process a file to remove EXIF data if supported
 * Returns a new File object with EXIF data removed, or the original file if not supported
 */
export async function processFileForExifRemoval(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  try {
    await initExifRemover();

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    if (!isExifRemovalSupported(uint8Array)) {
      return file;
    }

    const processedData = removeExifData(uint8Array);

    return new File([processedData], file.name, {
      type: file.type,
      lastModified: file.lastModified,
    });
  } catch (error) {
    console.error('Error processing file for EXIF removal:', error);
    return file;
  }
}

/**
 * Process multiple files for EXIF removal
 */
export async function processFilesForExifRemoval(files: File[]): Promise<File[]> {
  try {
    await initExifRemover();

    return await Promise.all(files.map(file => processFileForExifRemoval(file)));
  } catch (error) {
    console.error('Error processing files for EXIF removal:', error);
    return files;
  }
}

