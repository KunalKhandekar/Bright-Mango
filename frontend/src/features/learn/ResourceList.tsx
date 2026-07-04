import { useQuery } from '@tanstack/react-query'
import { Download, FileText, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { getResourceDownloadUrl, listLessonResources } from '@/api/resources'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/error-messages'
import { keys } from '@/lib/query-client'

function formatBytes(bytes?: number): string | null {
  if (!bytes) return null
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

export function ResourceList({ lessonId }: { lessonId: string }) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const { data, isPending } = useQuery({
    queryKey: keys.lessonResources(lessonId),
    queryFn: () => listLessonResources(lessonId),
  })

  const handleDownload = async (id: string) => {
    setDownloadingId(id)
    try {
      const { url } = await getResourceDownloadUrl(id)
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setDownloadingId(null)
    }
  }

  if (isPending) return <Skeleton className="h-24 w-full" />

  const resources = data?.resources ?? []
  if (resources.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">No resources for this lesson.</p>
  }

  return (
    <ul className="space-y-2">
      {resources.map((resource) => (
        <li key={resource._id} className="flex items-center gap-3 rounded-lg border p-3">
          <FileText className="text-muted-foreground size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{resource.title}</p>
            <p className="text-muted-foreground truncate text-xs">
              {resource.fileName}
              {formatBytes(resource.fileSize) ? ` · ${formatBytes(resource.fileSize)}` : ''}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={downloadingId !== null}
            onClick={() => handleDownload(resource._id)}
          >
            {downloadingId === resource._id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            <span className="hidden sm:inline">Download</span>
          </Button>
        </li>
      ))}
    </ul>
  )
}
