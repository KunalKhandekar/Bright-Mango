import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createAvatarUploadUrl, updateProfile } from '@/api/users'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { PageHeader } from '@/components/shared/PageHeader'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { errorMessage } from '@/lib/error-messages'
import { isApiError } from '@/types/api'
import { useAuthStore } from '@/stores/auth.store'
import { useDirectUpload } from '@/hooks/use-direct-upload'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // 2MB

export function ProfilePage() {
  const { user, setUser } = useAuthStore()
  const [name, setName] = useState(user?.name ?? '')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { phase, progress, upload, reset } = useDirectUpload()

  const handlePhoto = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('Photo must be under 2MB')
      return
    }
    try {
      const { uploadUrl, publicUrl } = await createAvatarUploadUrl({
        fileName: file.name,
        contentType: file.type,
      })
      const ok = await upload(uploadUrl, file, { method: 'PUT' })
      if (!ok) {
        toast.error('Upload failed. Please try again.')
        reset()
        return
      }
      const { user: updated } = await updateProfile({ avatar: publicUrl })
      setUser(updated)
      toast.success('Profile photo updated')
      reset()
    } catch (err) {
      reset()
      if (isApiError(err, 'INTEGRATION_NOT_CONFIGURED')) {
        toast.error("Photo upload isn't set up yet. Ask the platform admin to configure storage.")
      } else {
        toast.error(errorMessage(err))
      }
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { user: updated } = await updateProfile({ name: name.trim() || undefined })
      setUser(updated)
      toast.success('Profile updated')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title="Profile" description="How you appear across BrightMango." />
      <Card>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="group relative rounded-full"
              onClick={() => fileRef.current?.click()}
              aria-label="Change profile photo"
              disabled={phase === 'uploading'}
            >
              <UserAvatar
                name={name || user?.name}
                email={user?.email}
                avatar={user?.avatar}
                className="size-16"
              />
              <span className="bg-background/70 absolute inset-0 hidden items-center justify-center rounded-full group-hover:flex">
                <Camera className="size-5" />
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{user?.email}</p>
              <p className="text-muted-foreground text-sm capitalize">{user?.role}</p>
              {phase === 'uploading' ? (
                <div className="mt-2 flex items-center gap-2">
                  <Progress value={progress} className="w-40" />
                  <span className="text-muted-foreground text-xs">{progress}%</span>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera className="size-3.5" /> Change photo
                </Button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handlePhoto(file)
                e.target.value = ''
              }}
            />
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={120}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
