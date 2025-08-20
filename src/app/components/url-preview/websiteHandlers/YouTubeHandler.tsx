import React, { useState, useCallback } from 'react';
import { Box, Button, Icon, Icons, Text, config, color } from 'folds';
import { WebsiteHandler, WebsiteHandlerResult } from './types';
import * as css from '../UrlPreview.css';

const YOUTUBE_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)(?:&.*)?$/,
  /^https?:\/\/(www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)(?:\?.*)?$/,
  /^https?:\/\/()?youtu\.be\/([a-zA-Z0-9_-]+)(?:\?.*)?$/,
  /^https?:\/\/(www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]+)(?:\?.*)?$/,
];

const extractVideoId = (url: string): string | null => {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      return match[2];
    }
  }
  return null;
};

interface YouTubeEmbedProps {
  url: string;
  ts: number;
}

const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({ url }) => {
  const [hasError, setHasError] = useState(false);
  
  const videoId = extractVideoId(url);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  if (!videoId) {
    return null;
  }

  if (hasError) {
    return (
      <Box
        className={css.UrlPreview}
        direction="Column"
        alignItems="Center"
        justifyContent="Center"
        style={{ 
          minHeight: '200px',
          backgroundColor: color.Surface.Container,
          borderRadius: config.radii.R300,
          padding: config.space.S400
        }}
      >
        <Icon src={Icons.Warning} size="600" />
        <Text size="T300" align="Center">
          Failed to load YouTube video
        </Text>
      </Box>
    );
  }

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0`;

  return (
    <Box
      className={css.UrlPreview}
      style={{
        borderRadius: config.radii.R300,
        overflow: 'hidden',
        width: 'fit-content',
        maxWidth: '100%'
      }}
    >
      <iframe
        src={embedUrl}
        title="YouTube video player"
        width="640"
        height="360"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        style={{
          maxWidth: '100%',
          border: 'none',
          display: 'block'
        }}
        onError={handleError}
      />
    </Box>
  );
};

export const youtubeHandler: WebsiteHandler = {
  name: 'YouTube',
  test: (url: string) => {
    return YOUTUBE_PATTERNS.some(pattern => pattern.test(url));
  },
  handle: (url: string): WebsiteHandlerResult | null => {
    const videoId = extractVideoId(url);
    if (!videoId) return null;

    return {
      type: 'embed',
      component: YouTubeEmbed,
      shouldReplace: true,
    };
  },
};
