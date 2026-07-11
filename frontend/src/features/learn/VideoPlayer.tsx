import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'
import { MediaPlayer, MediaProvider, type MediaPlayerInstance } from '@vidstack/react'
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from '@vidstack/react/player/layouts/default'
import { forwardRef, useRef } from 'react'
import { env } from '@/lib/env'

interface VideoPlayerProps {
  /** Signed playback token from GET /lessons/:id/playback */
  token: string
  title: string
  poster?: string
  autoPlay?: boolean
  /** Resume position (seconds). Applied once when the media is ready. */
  startTime?: number
  onEnded?: () => void
}

/** Signed Cloudflare Stream HLS manifest: the token substitutes for the video uid. */
export function manifestUrl(token: string): string {
  return `https://${env.streamCustomerDomain}/${token}/manifest/video.m3u8`
}

export const VideoPlayer = forwardRef<MediaPlayerInstance, VideoPlayerProps>(
  function VideoPlayer({ token, title, poster, autoPlay = false, startTime = 0, onEnded }, ref) {
    const innerRef = useRef<MediaPlayerInstance | null>(null)
    const resumedRef = useRef(false)

    // Assign the instance to both our internal ref and the forwarded ref.
    const setRef = (instance: MediaPlayerInstance | null) => {
      innerRef.current = instance
      if (typeof ref === 'function') ref(instance)
      else if (ref) ref.current = instance
    }

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
        ref={setRef}
        title={title}
        src={{ src: manifestUrl(token), type: 'application/x-mpegurl' }}
        poster={poster}
        autoPlay={autoPlay}
        playsInline
        className="aspect-video w-full overflow-hidden rounded-lg bg-black"
        onCanPlay={handleCanPlay}
        onEnded={onEnded}
      >
        <MediaProvider />
        <DefaultVideoLayout icons={defaultLayoutIcons} />
      </MediaPlayer>
    )
  },
)
