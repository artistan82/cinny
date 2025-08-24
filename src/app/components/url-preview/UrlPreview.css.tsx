import { style, styleVariants } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

export const UrlPreview = style([
  DefaultReset,
  {
    maxWidth: toRem(400),
    minHeight: toRem(102),
    backgroundColor: color.SurfaceVariant.Container,
    color: color.SurfaceVariant.OnContainer,
    border: `${config.borderWidth.B300} solid ${color.SurfaceVariant.ContainerLine}`,
    borderRadius: config.radii.R300,
    overflow: 'hidden',
    display: 'flex',
    gap: config.space.S200,

    // Mobile-first approach - vertical layout
    flexDirection: 'column',

    // Desktop - horizontal layout with image on left, content on right
    '@media': {
      '(min-width: 768px)': {
        flexDirection: 'row',
      },
    },
  },
]);

export const UrlPreviewImageContainer = style([
  DefaultReset,
  {
    position: 'relative',
    cursor: 'pointer',
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: config.radii.R200,

    // Mobile - full width, max height 200px
    width: '100%',
    maxHeight: toRem(200),

    // Desktop - fixed width with aspect ratio maintained
    '@media': {
      '(min-width: 768px)': {
        width: toRem(120),
        maxHeight: 'none',
        minHeight: toRem(80),
      },
    },
  },
]);

export const UrlPreviewImg = style([
  DefaultReset,
  {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center',
    display: 'block',
    transition: 'transform 150ms ease',

    // Maintain aspect ratio
    aspectRatio: 'auto',

    ':hover': {
      transform: 'scale(1.02)',
    },
  },
]);

export const UrlPreviewContent = style([
  DefaultReset,
  {
    padding: config.space.S200,
    display: 'flex',
    flexDirection: 'column',
    gap: config.space.S100,
    flex: 1,
    minWidth: 0, // Allow text truncation
  },
]);

export const UrlPreviewSiteName = style([
  DefaultReset,
  {
    fontSize: '0.75rem',
    fontWeight: 500,
    opacity: 0.8,
    textTransform: 'uppercase',
    letterSpacing: '0.025em',
  },
]);

export const UrlPreviewTitle = style([
  DefaultReset,
  {
    fontSize: '0.875rem',
    fontWeight: 600,
    lineHeight: 1.2,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
]);

export const UrlPreviewDescription = style([
  DefaultReset,
  {
    fontSize: '0.8rem',
    lineHeight: 1.3,
    opacity: 0.9,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
  },
]);

export const UrlPreviewLink = style([
  DefaultReset,
  {
    fontSize: '0.75rem',
    opacity: 0.7,
    textDecoration: 'none',
    color: 'inherit',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',

    ':hover': {
      textDecoration: 'underline',
    },
  },
]);

// Image overlay styles
export const ImageOverlay = style([
  DefaultReset,
  {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: config.space.S400,
    cursor: 'pointer',
  },
]);

export const ImageOverlayContent = style([
  DefaultReset,
  {
    position: 'relative',
    cursor: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100vw',
    maxHeight: '100vh',
    overflow: 'auto',
  },
]);

export const ImageOverlayImg = style([
  DefaultReset,
  {
    maxWidth: '80vw',
    maxHeight: '80vh',
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
    borderRadius: config.radii.R300,
    display: 'block',
    transition: 'all 0.2s ease',
  },
]);

export const ImageOverlayImgZoomed = style([
  DefaultReset,
  {
    maxWidth: 'none',
    maxHeight: 'none',
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
    borderRadius: config.radii.R300,
    display: 'block',
    transition: 'all 0.2s ease',
  },
]);

// UrlPreviewHolder styles for horizontal scrolling
export const UrlPreviewHolderGradient = styleVariants({
  Left: [
    {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      width: toRem(20),
      background: `linear-gradient(to right, ${color.SurfaceVariant.Container}, transparent)`,
      pointerEvents: 'none',
      zIndex: 1,
    },
  ],
  Right: [
    {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: toRem(20),
      background: `linear-gradient(to left, ${color.SurfaceVariant.Container}, transparent)`,
      pointerEvents: 'none',
      zIndex: 1,
    },
  ],
});

export const UrlPreviewHolderBtn = styleVariants({
  Left: [
    {
      position: 'absolute',
      top: '50%',
      left: toRem(4),
      transform: 'translateY(-50%)',
      zIndex: 2,
    },
  ],
  Right: [
    {
      position: 'absolute',
      top: '50%',
      right: toRem(4),
      transform: 'translateY(-50%)',
      zIndex: 2,
    },
  ],
});
