import React from 'react';
import { as } from 'folds';
import classNames from 'classnames';
import * as css from './layout.css';

export const MessageBase = as<'div', css.MessageBaseVariants>(
  ({ className, highlight, selected, collapse, autoCollapse, space, ...props }, ref) => (
    <div
      className={classNames(
        css.MessageBase({ highlight, selected, collapse, autoCollapse, space }),
        className
      )}
      {...props}
      ref={ref}
    />
  )
);

export const AvatarBase = as<'span'>(({ className, ...props }, ref) => (
  <span className={classNames(css.AvatarBase, className)} {...props} ref={ref} />
));

export const Username = as<'span'>(({ as: AsUsername = 'span', className, ...props }, ref) => (
  <AsUsername className={classNames(css.Username, className)} {...props} ref={ref} />
));

export const UsernameBold = as<'b'>(({ as: AsUsernameBold = 'b', className, ...props }, ref) => (
  <AsUsernameBold className={classNames(css.UsernameBold, className)} {...props} ref={ref} />
));

export const MessageTextBody = as<'div', css.MessageTextBodyVariants & { notice?: boolean }>(
  ({ as: asComp = 'div', className, preWrap, jumboEmoji, emote, notice, ...props }, ref) => {
    const Component = asComp;
    return (
      <Component
        className={classNames(
          'text',
          !jumboEmoji && 'text-b1',
          notice ? 'text-medium' : 'text-normal',
          css.MessageTextBody({ preWrap, jumboEmoji, emote }),
          className
        )}
        style={{
          color: notice ? 'var(--tc-surface-normal-low)' : 'var(--tc-surface-normal)',
          ...(jumboEmoji && { fontSize: '24px' }),
        }}
        css={`
          img.emoji,
          img[data-mx-emoticon] {
            height: ${jumboEmoji ? '24px' : 'calc(var(--lh-b1) - 0.25rem)'} !important;
            margin: 0 !important;
            margin-right: 2px !important;
            padding: 0 !important;
            position: relative;
            top: -0.1rem;
            vertical-align: middle;
          }
        `}
        {...props}
        ref={ref}
      />
    );
  }
);
