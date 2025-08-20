import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IPreviewUrlResponse } from 'matrix-js-sdk';
import { Box, Icon, IconButton, Icons, Scroll, Spinner, as, config } from 'folds';
import { AsyncStatus, useAsyncCallback, AsyncState } from '../../hooks/useAsyncCallback';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import {
  UrlPreview,
  UrlPreviewContent,
  UrlPreviewDescription,
  UrlPreviewImage,
  UrlPreviewLink,
  UrlPreviewSiteName,
  UrlPreviewTitle,
} from './UrlPreview';
import {
  getIntersectionObserverEntry,
  useIntersectionObserver,
} from '../../hooks/useIntersectionObserver';
import { tryDecodeURIComponent } from '../../utils/dom';
import { mxcUrlToHttp } from '../../utils/matrix';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { websiteHandlerRegistry } from './websiteHandlers/registry';
import * as css from './UrlPreviewCard.css';

const MAX_THUMBNAIL_SIZE = 600;

export const UrlPreviewCard = as<'div', { url: string; ts: number }>(
  ({ url, ts, ...props }, ref) => {
    const mx = useMatrixClient();
    const useAuthentication = useMediaAuthentication();
    const [websiteHandlersEnabled] = useSetting(settingsAtom, 'websiteHandlers');
    
    const [previewStatus, setPreviewStatus] = useState<AsyncState<IPreviewUrlResponse, unknown>>({
      status: AsyncStatus.Idle,
    });

    // Check if we have a website handler for this URL
    const websiteHandler = useMemo(() => {
      if (!websiteHandlersEnabled) return null;
      return websiteHandlerRegistry.getHandler(url);
    }, [url, websiteHandlersEnabled]);

    const loadPreviewSafely = useCallback(async () => {
      setPreviewStatus({ status: AsyncStatus.Loading });
      
      try {
        const data = await mx.getUrlPreview(url, ts);
        setPreviewStatus({ 
          status: AsyncStatus.Success, 
          data 
        });
      } catch (error) {
        // Log the error for debugging but don't let it crash the app
        console.warn('Failed to load URL preview for:', url, error);
        
        // If it's a network error, we can optionally log more details
        if (error instanceof TypeError && error.message.includes('NetworkError')) {
          console.warn('Network error occurred while fetching URL preview. The URL might be invalid or unreachable:', url);
        }
        
        setPreviewStatus({ 
          status: AsyncStatus.Error, 
          error 
        });
      }
    }, [mx, url, ts]);

    useEffect(() => {
      // If we have a website handler that completely replaces the preview, 
      // don't fetch the default preview
      if (websiteHandler?.handle(url)?.shouldReplace) {
        return;
      }
      
      loadPreviewSafely();
    }, [loadPreviewSafely, websiteHandler, url]);

    // If website handlers are enabled and we have a handler, use it
    if (websiteHandler) {
      const handlerResult = websiteHandler.handle(url);
      if (handlerResult) {
        const { component: HandlerComponent, shouldReplace } = handlerResult;
        
        if (shouldReplace) {
          // Completely replace the default preview with the handler
          return (
            <UrlPreview {...props} ref={ref}>
              <HandlerComponent url={url} ts={ts} />
            </UrlPreview>
          );
        } else {
          // Show both the handler and the default preview
          // This would be for enhanced previews that supplement the default
          // We'll implement this if needed for other handlers
        }
      }
    }

    // Extract preview data at the top level - do this BEFORE any early returns
    const previewData = previewStatus.status === AsyncStatus.Success ? previewStatus.data : null;
    const ogImage = previewData?.['og:image'];
    const ogImageWidth = previewData ? Number(previewData['og:image:width']) || null : null;
    const ogImageHeight = previewData ? Number(previewData['og:image:height']) || null : null;
    const siteName = previewData?.['og:site_name'];
    const title = previewData?.['og:title'];
    const description = previewData?.['og:description'];

    // Calculate aspect ratio at the top level - BEFORE any early returns
    const aspectRatio = useMemo(() => {
      if (ogImageWidth && ogImageHeight) {
        return ogImageWidth / ogImageHeight;
      }
      return null;
    }, [ogImageWidth, ogImageHeight]);

    // Generate image URLs at the top level - BEFORE any early returns
    const { thumbnailUrl, fullImageUrl } = useMemo(() => {
      if (!ogImage) return { thumbnailUrl: null, fullImageUrl: null };

      // Extract MXC ID from the og:image URL
      const mxcMatch = ogImage.match(/^mxc:\/\/([^\/]+)\/(.+)$/);
      if (!mxcMatch) {
        // If not MXC URL, use as-is
        return { thumbnailUrl: ogImage, fullImageUrl: ogImage };
      }

      const [, serverName, mediaId] = mxcMatch;
      const baseUrl = mx.getHomeserverUrl();
      
      // Create thumbnail URL (max 600x600 as mentioned in the requirements)
      let thumbnailWidth = MAX_THUMBNAIL_SIZE;
      let thumbnailHeight = MAX_THUMBNAIL_SIZE;
      
      // Calculate optimal thumbnail dimensions while maintaining aspect ratio
      if (aspectRatio) {
        if (aspectRatio > 1) {
          // Landscape: limit width, calculate height
          thumbnailHeight = Math.min(MAX_THUMBNAIL_SIZE, Math.round(MAX_THUMBNAIL_SIZE / aspectRatio));
        } else {
          // Portrait: limit height, calculate width
          thumbnailWidth = Math.min(MAX_THUMBNAIL_SIZE, Math.round(MAX_THUMBNAIL_SIZE * aspectRatio));
        }
      }

      const thumbnailUrl = `${baseUrl}/_matrix/client/v1/media/thumbnail/${serverName}/${mediaId}?width=${thumbnailWidth}&height=${thumbnailHeight}&method=scale`;
      
      // Create full image download URL
      const fullImageUrl = `${baseUrl}/_matrix/client/v1/media/download/${serverName}/${mediaId}`;
      
      return { thumbnailUrl, fullImageUrl };
    }, [ogImage, aspectRatio, mx]);

    const renderContent = () => (
      <>
        {thumbnailUrl && (
          <UrlPreviewImage
            src={thumbnailUrl}
            fullSrc={fullImageUrl || undefined}
            alt={title || 'Preview image'}
            title={title || undefined}
            aspectRatio={aspectRatio || undefined}
          />
        )}
        <UrlPreviewContent>
          {siteName && (
            <UrlPreviewSiteName>
              {siteName}
            </UrlPreviewSiteName>
          )}
          
          {title && (
            <UrlPreviewTitle>
              {title}
            </UrlPreviewTitle>
          )}
          
          {description && (
            <UrlPreviewDescription>
              {description}
            </UrlPreviewDescription>
          )}
          
          <UrlPreviewLink
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={url}
          >
            {tryDecodeURIComponent(url)}
          </UrlPreviewLink>
        </UrlPreviewContent>
      </>
    );

    if (previewStatus.status === AsyncStatus.Error) {
      return null;
    }

    return (
      <UrlPreview {...props} ref={ref}>
        {previewStatus.status === AsyncStatus.Success ? (
          renderContent()
        ) : (
          <Box alignItems="Center" justifyContent="Center" style={{ minHeight: '102px' }}>
            <Spinner variant="Secondary" size="600" />
          </Box>
        )}
      </UrlPreview>
    );
  }
);

export const UrlPreviewHolder = as<'div'>(({ children, ...props }, ref) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const backAnchorRef = useRef<HTMLDivElement>(null);
  const frontAnchorRef = useRef<HTMLDivElement>(null);
  const [backVisible, setBackVisible] = useState(true);
  const [frontVisible, setFrontVisible] = useState(true);

  const intersectionObserver = useIntersectionObserver(
    useCallback((entries) => {
      const backAnchor = backAnchorRef.current;
      const frontAnchor = frontAnchorRef.current;
      const backEntry = backAnchor && getIntersectionObserverEntry(backAnchor, entries);
      const frontEntry = frontAnchor && getIntersectionObserverEntry(frontAnchor, entries);
      if (backEntry) {
        setBackVisible(backEntry.isIntersecting);
      }
      if (frontEntry) {
        setFrontVisible(frontEntry.isIntersecting);
      }
    }, []),
    useCallback(
      () => ({
        root: scrollRef.current,
        rootMargin: '10px',
      }),
      []
    )
  );

  useEffect(() => {
    const scrollElement = scrollRef.current;
    const backAnchor = backAnchorRef.current;
    const frontAnchor = frontAnchorRef.current;
    if (!scrollElement || !backAnchor || !frontAnchor) return;

    intersectionObserver?.observe(backAnchor);
    intersectionObserver?.observe(frontAnchor);
    return () => {
      intersectionObserver?.unobserve(backAnchor);
      intersectionObserver?.unobserve(frontAnchor);
    };
  });

  const handleBackClick = () => {
    scrollRef.current?.scrollBy({
      left: -295,
      behavior: 'smooth',
    });
  };
  const handleFrontClick = () => {
    scrollRef.current?.scrollBy({
      left: 295,
      behavior: 'smooth',
    });
  };

  return (
    <Box {...props} ref={ref} direction="Column" gap="200">
      <Box position="Relative">
        {!backVisible && (
          <>
            <div className={css.UrlPreviewHolderGradient({ position: 'Left' })} />
            <IconButton
              className={css.UrlPreviewHolderBtn({ position: 'Left' })}
              variant="SurfaceVariant"
              size="300"
              radii="Pill"
              onClick={handleBackClick}
            >
              <Icon src={Icons.ChevronLeft} />
            </IconButton>
          </>
        )}
        {!frontVisible && (
          <>
            <div className={css.UrlPreviewHolderGradient({ position: 'Right' })} />
            <IconButton
              className={css.UrlPreviewHolderBtn({ position: 'Right' })}
              variant="SurfaceVariant"
              size="300"
              radii="Pill"
              onClick={handleFrontClick}
            >
              <Icon src={Icons.ChevronRight} />
            </IconButton>
          </>
        )}
        <Scroll ref={scrollRef} direction="Horizontal" hideTrack>
          <Box gap="200" direction="Row">
            <div ref={backAnchorRef} />
            {children}
            <div ref={frontAnchorRef} />
          </Box>
        </Scroll>
      </Box>
    </Box>
  );
});
