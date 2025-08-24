import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { Box, Icon, Icons, as } from 'folds';
import * as css from './UrlPreview.css';

export const UrlPreview = as<'div'>(({ className, ...props }, ref) => (
  <Box shrink="No" className={classNames(css.UrlPreview, className)} {...props} ref={ref} />
));

type UrlPreviewImageProps = {
  src: string;
  alt: string;
  title?: string;
  aspectRatio?: number;
  fullSrc?: string; // Full resolution image URL for overlay
  onImageClick?: () => void;
};

export const UrlPreviewImage = as<'div', UrlPreviewImageProps>(
  ({ className, src, alt, title, aspectRatio, fullSrc, onImageClick, ...props }, ref) => {
    const [imageOverlay, setImageOverlay] = useState(false);
    const [isZoomed, setIsZoomed] = useState(false);
    const [canZoom, setCanZoom] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    const handleImageClick = useCallback(() => {
      if (onImageClick) {
        onImageClick();
      } else if (fullSrc) {
        setImageOverlay(true);
        setIsZoomed(false); // Reset zoom when opening overlay
      }
    }, [onImageClick, fullSrc]);

    const handleOverlayClick = useCallback((event: React.MouseEvent) => {
      // Close overlay when clicking outside the image
      if (event.target === overlayRef.current) {
        setImageOverlay(false);
        setIsZoomed(false);
        setCanZoom(false);
      }
    }, []);

    const handleImageLoad = useCallback(() => {
      const img = imageRef.current;
      if (!img) return;

      // Calculate the constrained size (80% of viewport)
      const maxConstrainedWidth = window.innerWidth * 0.8;
      const maxConstrainedHeight = window.innerHeight * 0.8;

      // Check if natural size is larger than constrained size
      const wouldZoomEnlarge =
        img.naturalWidth > maxConstrainedWidth || img.naturalHeight > maxConstrainedHeight;

      setCanZoom(wouldZoomEnlarge);
    }, []);

    const handleImageOverlayClick = useCallback(
      (event: React.MouseEvent) => {
        // Prevent event from bubbling to overlay container
        event.stopPropagation();
        // Toggle zoom state only if zoom would enlarge the image
        if (canZoom) {
          setIsZoomed((prev) => !prev);
        }
      },
      [canZoom]
    );

    const handleCloseOverlay = useCallback(() => {
      setImageOverlay(false);
      setIsZoomed(false);
      setCanZoom(false);
    }, []);

    // Handle escape key
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && imageOverlay) {
          setImageOverlay(false);
        }
      };

      if (imageOverlay) {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
      }
    }, [imageOverlay]);

    return (
      <>
        <div
          className={classNames(css.UrlPreviewImageContainer, className)}
          style={aspectRatio ? { aspectRatio: `${aspectRatio}` } : undefined}
          onClick={handleImageClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleImageClick();
            }
          }}
          {...props}
          ref={ref}
        >
          <img className={css.UrlPreviewImg} src={src} alt={alt} title={title} />
        </div>

        {/* Image Overlay Modal */}
        {imageOverlay && fullSrc && (
          <div className={css.ImageOverlay} ref={overlayRef} onClick={handleOverlayClick}>
            <div className={css.ImageOverlayContent}>
              <img
                ref={imageRef}
                className={isZoomed ? css.ImageOverlayImgZoomed : css.ImageOverlayImg}
                src={fullSrc}
                alt={alt}
                title={title}
                onLoad={handleImageLoad}
                onClick={handleImageOverlayClick}
                style={{
                  cursor: canZoom ? 'pointer' : 'default',
                }}
              />
            </div>
          </div>
        )}
      </>
    );
  }
);

export const UrlPreviewContent = as<'div'>(({ className, ...props }, ref) => (
  <div className={classNames(css.UrlPreviewContent, className)} {...props} ref={ref} />
));

export const UrlPreviewSiteName = as<'div'>(({ className, ...props }, ref) => (
  <div className={classNames(css.UrlPreviewSiteName, className)} {...props} ref={ref} />
));

export const UrlPreviewTitle = as<'h3'>(({ className, ...props }, ref) => (
  <h3 className={classNames(css.UrlPreviewTitle, className)} {...props} ref={ref} />
));

export const UrlPreviewDescription = as<'p'>(({ className, ...props }, ref) => (
  <p className={classNames(css.UrlPreviewDescription, className)} {...props} ref={ref} />
));

export const UrlPreviewLink = as<'a'>(({ className, ...props }, ref) => (
  <a className={classNames(css.UrlPreviewLink, className)} {...props} ref={ref} />
));
