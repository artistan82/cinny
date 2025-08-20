import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, config, color } from 'folds';
import { WebsiteHandler, WebsiteHandlerResult } from './types';
import * as css from '../UrlPreview.css';

// Twitter/X URL patterns
const TWITTER_PATTERNS = [
  /^https?:\/\/(?:www\.)?twitter\.com\/[^\/]+\/status\/\d+/,
  /^https?:\/\/(?:www\.)?x\.com\/[^\/]+\/status\/\d+/,
];

const extractTweetInfo = (url: string): { username: string; tweetId: string } | null => {
  const match = url.match(/^https?:\/\/(?:www\.)?(twitter\.com|x\.com)\/([^\/]+)\/status\/(\d+)/);
  if (match) {
    return {
      username: match[2],
      tweetId: match[3],
    };
  }
  return null;
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
};

interface TwitterEmbedProps {
  url: string;
  ts: number;
}

const TwitterEmbed: React.FC<TwitterEmbedProps> = ({ url }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tweetData, setTweetData] = useState<any>(null);

  useEffect(() => {
    const fetchTweet = async () => {
      const tweetInfo = extractTweetInfo(url);
      
      if (!tweetInfo) {
        setError('Invalid Twitter URL');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const apiUrl = `https://api.fxtwitter.com/${tweetInfo.username}/status/${tweetInfo.tweetId}`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.code !== 200) {
          throw new Error(data.message || 'Failed to fetch tweet');
        }
        
        setTweetData(data.tweet);
      } catch (err) {
        console.error('TwitterEmbed: Error fetching tweet:', err);
        setError(err instanceof Error ? err.message : 'Failed to load tweet');
      } finally {
        setLoading(false);
      }
    };

    fetchTweet();
  }, [url]);

  if (loading) {
    return (
      <Box
        className={css.UrlPreview}
        direction="Column"
        alignItems="Center"
        justifyContent="Center"
        style={{ 
          minHeight: '120px',
          backgroundColor: color.Surface.Container,
          borderRadius: config.radii.R300,
          padding: config.space.S400
        }}
      >
        <Text size="T300">Loading tweet...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        className={css.UrlPreview}
        direction="Column"
        alignItems="Center"
        justifyContent="Center"
        style={{ 
          minHeight: '120px',
          backgroundColor: color.Surface.Container,
          borderRadius: config.radii.R300,
          padding: config.space.S400
        }}
      >
        <Text size="T300" style={{ color: color.Critical.Main }}>
          {error}
        </Text>
      </Box>
    );
  }

  if (!tweetData) return null;

  const renderQuoteTweet = () => {
    const { quote } = tweetData;
    if (!quote) return null;

    return (
      <Box
        style={{
          marginLeft: config.space.S400,
          marginRight: config.space.S400,
          marginBottom: config.space.S300,
          padding: config.space.S300,
          backgroundColor: color.SurfaceVariant.Container,
          borderRadius: config.radii.R300,
          borderLeft: `3px solid ${color.Primary.Main}`
        }}
      >
        <Box direction="Row" alignItems="Center" style={{ marginBottom: config.space.S200 }}>
          {quote.author.avatar_url && (
            <img
              src={quote.author.avatar_url}
              alt={`${quote.author.name} avatar`}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                marginRight: config.space.S200
              }}
            />
          )}
          <Text size="T200" style={{ fontWeight: 'bold' }}>
            {quote.author.name}
          </Text>
          <Text size="T200" style={{ color: color.Surface.OnContainer, marginLeft: config.space.S100 }}>
            @{quote.author.screen_name}
          </Text>
        </Box>
        <Text size="T200" style={{ lineHeight: '1.4' }}>
          {quote.text}
        </Text>
      </Box>
    );
  };

  return (
    <Box
      className={css.UrlPreview}
      direction="Column"
      style={{
        borderRadius: config.radii.R300,
        backgroundColor: color.Surface.Container,
        maxWidth: '500px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Author Header - Section 1 */}
      <Box 
        direction="Row" 
        alignItems="Center" 
        gap="300"
        style={{ 
          paddingTop: config.space.S400,
          paddingLeft: config.space.S400,
          paddingRight: config.space.S400,
          paddingBottom: config.space.S100,
          width: '100%',
          display: 'flex'
        }}
      >
        {tweetData.author?.avatar_url && (
          <img
            src={tweetData.author.avatar_url}
            alt={`${tweetData.author.name} avatar`}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              marginRight: config.space.S300
            }}
          />
        )}
        <Box direction="Column">
          <Text size="T300" style={{ fontWeight: 'bold', lineHeight: '1.2' }}>
            {tweetData.author?.name || 'Unknown User'}
          </Text>
          <Text size="T200" style={{ color: color.Surface.OnContainer, opacity: 0.7 }}>
            @{tweetData.author?.screen_name || 'unknown'}
          </Text>
        </Box>
      </Box>

      {/* Tweet Text - Section 2 */}
      <Box style={{ 
        paddingLeft: config.space.S400,
        paddingRight: config.space.S400,
        marginBottom: config.space.S300,
        width: '100%'
      }}>
        <Text 
          size="T300" 
          style={{ 
            lineHeight: '1.4',
            whiteSpace: 'pre-wrap',
            display: 'block',
            width: '100%'
          }}
        >
          {tweetData.text}
        </Text>
      </Box>

      {/* Quote Tweet - Section 3 (if exists) */}
      {tweetData.quote && renderQuoteTweet()}

      {/* Media Section - Section 4 */}
      {tweetData.media?.photos && tweetData.media.photos.length > 0 && (
        <Box style={{ width: '100%', marginBottom: config.space.S100 }}>
          {tweetData.media.photos.length === 1 ? (
            <img
              src={tweetData.media.photos[0].url}
              alt="Tweet image"
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '400px',
                objectFit: 'cover',
                display: 'block'
              }}
            />
          ) : (
            <Box
              style={{
                display: 'grid',
                gap: '2px',
                marginLeft: config.space.S400,
                marginRight: config.space.S400,
                gridTemplateColumns: tweetData.media.photos.length === 2 ? '1fr 1fr' : 
                                   tweetData.media.photos.length === 3 ? '1fr 1fr 1fr' : 
                                   '1fr 1fr',
                gridTemplateRows: tweetData.media.photos.length === 4 ? '1fr 1fr' : '1fr'
              }}
            >
              {tweetData.media.photos.map((photo: any, index: number) => (
                <img
                  key={index}
                  src={photo.url}
                  alt={`Tweet image ${index + 1}`}
                  style={{
                    width: '100%',
                    height: '150px',
                    objectFit: 'cover'
                  }}
                />
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Videos Section */}
      {tweetData.media?.videos && tweetData.media.videos.length > 0 && (
        <Box style={{ width: '100%', marginBottom: config.space.S300 }}>
          {tweetData.media.videos.map((video: any, index: number) => (
            <video
              key={index}
              controls={video.type === 'video'}
              autoPlay={video.type === 'gif'}
              loop={video.type === 'gif'}
              muted={video.type === 'gif'}
              poster={video.thumbnail_url}
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '400px'
              }}
            >
              <source src={video.url} type={video.format} />
              Your browser does not support the video tag.
            </video>
          ))}
        </Box>
      )}

      {/* Stats Section - Section 5 */}
      <Box 
        direction="Row" 
        alignItems="Center" 
        gap="400"
        style={{ 
          paddingTop: config.space.S100,
          paddingLeft: config.space.S400,
          paddingRight: config.space.S400,
          paddingBottom: config.space.S200,
          width: '100%',
          display: 'flex'
        }}
      >
        <Text size="T200" style={{ color: color.Surface.OnContainer }}>
          🔁 {formatNumber(tweetData.retweets || 0)}
        </Text>
        <Text size="T200" style={{ color: color.Surface.OnContainer }}>
          ❤️ {formatNumber(tweetData.likes || 0)}
        </Text>
        {tweetData.views && (
          <Text size="T200" style={{ color: color.Surface.OnContainer }}>
            👁️ {formatNumber(tweetData.views)}
          </Text>
        )}
      </Box>
    </Box>
  );
};

export const twitterHandler: WebsiteHandler = {
  name: 'Twitter',
  test: (url: string) => {
    try {
      return TWITTER_PATTERNS.some(pattern => pattern.test(url));
    } catch (error) {
      console.warn('Error testing Twitter URL pattern:', error);
      return false;
    }
  },
  handle: (url: string): WebsiteHandlerResult | null => {
    try {
      const tweetInfo = extractTweetInfo(url);
      if (!tweetInfo) return null;

      return {
        type: 'embed',
        component: TwitterEmbed,
        shouldReplace: true,
        metadata: {
          title: 'Tweet',
          siteName: 'Twitter',
          handlerName: 'Twitter'
        }
      };
    } catch (error) {
      console.warn('Error handling Twitter URL:', url, error);
      return null;
    }
  },
};
