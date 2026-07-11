import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'
import { MediaPlayer, MediaProvider, type MediaPlayerInstance } from '@vidstack/react'
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from '@vidstack/react/player/layouts/default'
import { useRef } from 'react'
import { env } from '@/lib/env'

type MediaPlayerProps = React.ComponentProps<typeof MediaPlayer>

interface VideoPlayerProps {
  /** Signed playback token from GET /lessons/:id/playback */
  token: string
  title: string
  poster?: string
  autoPlay?: boolean
  /** Resume position (seconds). Applied once when the media is ready. */
  startTime?: number
  onEnded?: () => void
  // Progress-reporter handlers (Vidstack React event props). Optional so the player works
  // standalone; forwarded straight to <MediaPlayer>.
  onTimeUpdate?: MediaPlayerProps['onTimeUpdate']
  onPlay?: MediaPlayerProps['onPlay']
  onPause?: MediaPlayerProps['onPause']
  onSeeking?: MediaPlayerProps['onSeeking']
}

/** Signed Cloudflare Stream HLS manifest: the token substitutes for the video uid. */
function manifestUrl(token: string): string {
  return `https://${env.streamCustomerDomain}/${token}/manifest/video.m3u8`
}

export function VideoPlayer({
  token,
  title,
  poster,
  autoPlay = false,
  startTime = 0,
  onEnded,
  onTimeUpdate,
  onPlay,
  onPause,
  onSeeking,
}: VideoPlayerProps) {
  const innerRef = useRef<MediaPlayerInstance | null>(null)
  const resumedRef = useRef(false)

  const handleCanPlay = () => {
    if (resumedRef.current || startTime <= 0) return
    resumedRef.current = true
    try {
      innerRef.current!.currentTime = startTime
    } catch {
      // provider not ready; leave at 0
    }
  }

  return (
    <MediaPlayer
      ref={innerRef}
      title={title}
      src={{ src: manifestUrl(token), type: 'application/x-mpegurl' }}
      poster={poster}
      autoPlay={autoPlay}
      playsInline
      className="aspect-video w-full overflow-hidden rounded-lg bg-black"
      onCanPlay={handleCanPlay}
      onEnded={onEnded}
      onTimeUpdate={onTimeUpdate}
      onPlay={onPlay}
      onPause={onPause}
      onSeeking={onSeeking}
    >
      <MediaProvider />
      <DefaultVideoLayout icons={defaultLayoutIcons} />
    </MediaPlayer>
  )
}
