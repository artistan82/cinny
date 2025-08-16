import { ReactNode, useCallback, useMemo } from 'react';
import { Capabilities, validateAuthMetadata, ValidatedAuthMetadata } from 'matrix-js-sdk';
import { AsyncStatus, useAsyncCallbackValue } from '../hooks/useAsyncCallback';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { MediaConfig } from '../hooks/useMediaConfig';
import { promiseFulfilledResult } from '../utils/common';
import { ErrorCode } from '../cs-errorcode';

export type ServerConfigs = {
  capabilities?: Capabilities;
  mediaConfig?: MediaConfig;
  authMetadata?: ValidatedAuthMetadata;
};

async function safeGetAuthMetadata(mx: any): Promise<any> {
  try {
    return await mx.getAuthMetadata();
  } catch (error: any) {
    if (
      error?.errcode === ErrorCode.M_UNRECOGNIZED ||
      error?.errcode === 'M_UNRECOGNIZED' ||
      error?.httpStatus === 404 ||
      error?.status === 404 ||
      (error?.message && error.message.includes('Unrecognized request'))
    ) {
      console.debug('Server does not support OAuth 2.0 authentication metadata (MSC2965)');
      return null;
    }
    
    console.warn('Unexpected error fetching auth metadata:', error);
    return null;
  }
}

type ServerConfigsLoaderProps = {
  children: (configs: ServerConfigs) => ReactNode;
};
export function ServerConfigsLoader({ children }: ServerConfigsLoaderProps) {
  const mx = useMatrixClient();
  const fallbackConfigs = useMemo(() => ({}), []);

  const [configsState] = useAsyncCallbackValue<ServerConfigs, unknown>(
    useCallback(async () => {
      const result = await Promise.allSettled([
        mx.getCapabilities(),
        mx.getMediaConfig(),
        safeGetAuthMetadata(mx),
      ]);

      const capabilities = promiseFulfilledResult(result[0]);
      const mediaConfig = promiseFulfilledResult(result[1]);
      const authMetadata = promiseFulfilledResult(result[2]);
      let validatedAuthMetadata: ValidatedAuthMetadata | undefined;

      if (authMetadata) {
        try {
          validatedAuthMetadata = validateAuthMetadata(authMetadata);
        } catch (e) {
          console.warn('Failed to validate auth metadata:', e);
          validatedAuthMetadata = undefined;
        }
      }

      return {
        capabilities,
        mediaConfig,
        authMetadata: validatedAuthMetadata,
      };
    }, [mx])
  );

  const configs: ServerConfigs =
    configsState.status === AsyncStatus.Success ? configsState.data : fallbackConfigs;

  return children(configs);
}
