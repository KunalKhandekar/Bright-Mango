import { useState } from 'react'
import axios from 'axios'

export type UploadPhase = 'idle' | 'uploading' | 'done' | 'error'

/**
 * Direct-to-cloud upload state machine (Cloudflare Stream / R2 presigned URLs).
 * Uses a bare axios call — no credentials, no API base URL.
 */
export function useDirectUpload() {
  const [phase, setPhase] = useState<UploadPhase>('idle')
  const [progress, setProgress] = useState(0)

  const upload = async (
    url: string,
    file: File,
    options: { method: 'POST' | 'PUT'; fieldName?: string },
  ): Promise<boolean> => {
    setPhase('uploading')
    setProgress(0)
    try {
      const body =
        options.method === 'POST'
          ? (() => {
              const form = new FormData()
              form.append(options.fieldName ?? 'file', file)
              return form
            })()
          : file
      await axios.request({
        url,
        method: options.method,
        data: body,
        headers: options.method === 'PUT' ? { 'Content-Type': file.type } : undefined,
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100))
        },
      })
      setPhase('done')
      return true
    } catch {
      setPhase('error')
      return false
    }
  }

  const reset = () => {
    setPhase('idle')
    setProgress(0)
  }

  return { phase, progress, upload, reset }
}
