import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'
import { MediaPlayer, MediaProvider, type MediaPlayerInstance } from '@vidstack/react'
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from '@vidstack/react/player/layouts/default'
import { forwardRef } from 'react'
import { env } from '@/lib/env'

interface VideoPlayerProps {
  /** Signed playback token from GET /lessons/:id/playback */
  token: string
  title: string
  poster?: string
  autoPlay?: boolean
  onEnded?: () => void
}

/** Signed Cloudflare Stream HLS manifest: the token substitutes for the video uid. */
export function manifestUrl(token: string): string {
  return `https://${env.streamCustomerDomain}/${token}/manifest/video.m3u8`
}

export const VideoPlayer = forwardRef<MediaPlayerInstance, VideoPlayerProps>(
  function VideoPlayer({ token, title, poster, autoPlay = false, onEnded }, ref) {
    return (
      <MediaPlayer
        ref={ref}
        title={title}
        src={{ src: manifestUrl(token), type: 'application/x-mpegurl' }}
        poster={poster}
        autoPlay={autoPlay}
        playsInline
        className="aspect-video w-full overflow-hidden rounded-lg bg-black"
        onEnded={onEnded}
      >
        <MediaProvider />
        <DefaultVideoLayout icons={defaultLayoutIcons} />
      </MediaPlayer>
    )
  },
)
