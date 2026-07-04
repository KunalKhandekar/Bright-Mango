import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Loader2, Paperclip, Trash2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import {
  createResourceUploadUrl,
  deleteResource,
  listLessonResources,
  registerResource,
} from '@/api/resources'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { errorMessage } from '@/lib/error-messages'
import { keys } from '@/lib/query-client'
import { useDirectUpload } from '@/hooks/use-direct-upload'

interface PendingResource {
  file: File
  fileKey: string
  title: string
}

export function ResourceUploadCard({ lessonId }: { lessonId: string }) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const { phase, progress, upload, reset } = useDirectUpload()
  // Set when the file reached R2 but registration failed — retry re-runs only step 3.
  const [pending, setPending] = useState<PendingResource | null>(null)

  const resourcesQuery = useQuery({
    queryKey: keys.lessonResources(lessonId),
    queryFn: () => listLessonResources(lessonId),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: keys.lessonResources(lessonId) })

  const register = useMutation({
    mutationFn: (p: PendingResource) =>
      registerResource(lessonId, {
        title: p.title,
        fileKey: p.fileKey,
        fileName: p.file.name,
        fileSize: p.file.size,
        contentType: p.file.type || undefined,
      }),
    onSuccess: () => {
      setPending(null)
      reset()
      toast.success('Resource added')
      void invalidate()
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not save the resource')),
  })

  const remove = useMutation({
    mutationFn: deleteResource,
    onSuccess: () => void invalidate(),
    onError: (err) => toast.error(errorMessage(err)),
  })

  const handleFile = async (file: File) => {
    try {
      const { uploadUrl, fileKey } = await createResourceUploadUrl(lessonId, {
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
      })
      const ok = await upload(uploadUrl, file, { method: 'PUT' })
      if (!ok) {
        toast.error('Upload failed. Please try again.')
        reset()
        return
      }
      const item: PendingResource = { file, fileKey, title: file.name }
      setPending(item)
      register.mutate(item)
    } catch (err) {
      reset()
      toast.error(errorMessage(err))
    }
  }

  const resources = resourcesQuery.data?.resources ?? []

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Paperclip className="size-4" /> Resources
      </div>

      {resources.length > 0 && (
        <ul className="space-y-2">
          {resources.map((resource) => (
            <li key={resource._id} className="flex items-center gap-2 text-sm">
              <FileText className="text-muted-foreground size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{resource.title}</span>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label="Delete resource">
                    <Trash2 className="size-3.5" />
                  </Button>
                }
                title="Delete this resource?"
                description={`"${resource.title}" will no longer be available to students.`}
                confirmLabel="Delete"
                destructive
                onConfirm={() => remove.mutateAsync(resource._id).then(() => undefined)}
              />
            </li>
          ))}
        </ul>
      )}

      {phase === 'uploading' ? (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-muted-foreground text-xs">Uploading… {progress}%</p>
        </div>
      ) : pending && register.isError ? (
        <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-xs">
            The file uploaded but couldn't be saved. Adjust the title if needed and retry.
          </p>
          <div className="flex gap-2">
            <Input
              value={pending.title}
              onChange={(e) => setPending({ ...pending, title: e.target.value })}
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              disabled={register.isPending || !pending.title.trim()}
              onClick={() => register.mutate(pending)}
            >
              {register.isPending && <Loader2 className="size-3.5 animate-spin" />}
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
              e.target.value = ''
            }}
          />
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <UploadCloud className="size-4" /> Add file
          </Button>
        </>
      )}
    </div>
  )
}
