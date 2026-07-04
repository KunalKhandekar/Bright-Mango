import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateProfile } from '@/api/users'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/PageHeader'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { errorMessage } from '@/lib/error-messages'
import { useAuthStore } from '@/stores/auth.store'

export function ProfilePage() {
  const { user, setUser } = useAuthStore()
  const [name, setName] = useState(user?.name ?? '')
  const [avatar, setAvatar] = useState(user?.avatar ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { user: updated } = await updateProfile({
        name: name.trim() || undefined,
        avatar: avatar.trim() || undefined,
      })
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
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5">
            <div className="flex items-center gap-4">
              <UserAvatar
                name={name || user?.name}
                email={user?.email}
                avatar={avatar || user?.avatar}
                className="size-16"
              />
              <div className="min-w-0">
                <p className="font-medium">{user?.email}</p>
                <p className="text-muted-foreground text-sm capitalize">{user?.role}</p>
              </div>
            </div>
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
            <div className="space-y-2">
              <Label htmlFor="avatar">Avatar URL</Label>
              <Input
                id="avatar"
                type="url"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="https://…"
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
