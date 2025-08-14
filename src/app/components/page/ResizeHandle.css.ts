import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const ResizeHandle = style({
  position: 'absolute',
  top: 0,
  right: 0,
  width: toRem(4),
  height: '100%',
  cursor: 'col-resize',
  backgroundColor: 'transparent',
  borderRadius: 0,
  zIndex: 10,

  '::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: '50%',
    width: toRem(1),
    height: '100%',
    backgroundColor: 'transparent',
    transform: 'translateX(-50%)',
    transition: 'background-color 150ms ease-in-out',
  },

  ':hover::before': {
    backgroundColor: color.Background.ContainerLine,
  },

  ':active::before': {
    backgroundColor: color.Primary.Main,
  },

  // Expand the hover area
  '::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: toRem(-4),
    width: toRem(8),
    height: '100%',
  },
});
