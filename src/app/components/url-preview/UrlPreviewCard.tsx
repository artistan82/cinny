import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IPreviewUrlResponse } from 'matrix-js-sdk';
import { Box, Icon, IconButton, Icons, Scroll, Spinner, as, config } from 'folds';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
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
import * as css from './UrlPreview.css';

const MAX_THUMBNAIL_SIZE = 600;

export const UrlPreviewCard = as<'div', { url: string; ts: number }>(
  ({ url, ts, ...props }, ref) => {
    const mx = useMatrixClient();
    const useAuthentication = useMediaAuthentication();
    const [previewStatus, loadPreview] = useAsyncCallback(
      useCallback(() => mx.getUrlPreview(url, ts), [url, ts, mx])
    );

    useEffect(() => {
      loadPreview();
    }, [loadPreview]);

    if (previewStatus.status === AsyncStatus.Error) return null;

    // Extract preview data at the top level
    const previewData = previewStatus.status === AsyncStatus.Success ? previewStatus.data : null;
    const ogImage = previewData?.['og:image'];
    const ogImageWidth = previewData ? Number(previewData['og:image:width']) || null : null;
    const ogImageHeight = previewData ? Number(previewData['og:image:height']) || null : null;
    const siteName = previewData?.['og:site_name'];
    const title = previewData?.['og:title'];
    const description = previewData?.['og:description'];

    // Calculate aspect ratio at the top level
    const aspectRatio = useMemo(() => {
      if (ogImageWidth && ogImageHeight) {
        return ogImageWidth / ogImageHeight;
      }
      return null;
    }, [ogImageWidth, ogImageHeight]);

    // Generate image URLs at the top level
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
    const backAnchor = backAnchorRef.current;
    const frontAnchor = frontAnchorRef.current;
    if (backAnchor) intersectionObserver?.observe(backAnchor);
    if (frontAnchor) intersectionObserver?.observe(frontAnchor);
    return () => {
      if (backAnchor) intersectionObserver?.unobserve(backAnchor);
      if (frontAnchor) intersectionObserver?.unobserve(frontAnchor);
    };
  }, [intersectionObserver]);

  const handleScrollBack = () => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const { offsetWidth, scrollLeft } = scroll;
    scroll.scrollTo({
      left: scrollLeft - offsetWidth / 1.3,
      behavior: 'smooth',
    });
  };
  
  const handleScrollFront = () => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const { offsetWidth, scrollLeft } = scroll;
    scroll.scrollTo({
      left: scrollLeft + offsetWidth / 1.3,
      behavior: 'smooth',
    });
  };

  return (
    <Box
      direction="Column"
      {...props}
      ref={ref}
      style={{ marginTop: config.space.S200, position: 'relative' }}
    >
      <Scroll ref={scrollRef} direction="Horizontal" size="0" visibility="Hover" hideTrack>
        <Box shrink="No" alignItems="Center">
          <div ref={backAnchorRef} />
          {!backVisible && (
            <>
              <div className={css.UrlPreviewHolderGradient({ position: 'Left' })} />
              <IconButton
                className={css.UrlPreviewHolderBtn({ position: 'Left' })}
                variant="Secondary"
                radii="Pill"
                size="300"
                outlined
                onClick={handleScrollBack}
              >
                <Icon size="300" src={Icons.ArrowLeft} />
              </IconButton>
            </>
          )}
          <Box alignItems="Inherit" gap="200">
            {children}

            {!frontVisible && (
              <>
                <div className={css.UrlPreviewHolderGradient({ position: 'Right' })} />
                <IconButton
                  className={css.UrlPreviewHolderBtn({ position: 'Right' })}
                  variant="Primary"
                  radii="Pill"
                  size="300"
                  outlined
                  onClick={handleScrollFront}
                >
                  <Icon size="300" src={Icons.ArrowRight} />
                </IconButton>
              </>
            )}
            <div ref={frontAnchorRef} />
          </Box>
        </Box>
      </Scroll>
    </Box>
  );
});
