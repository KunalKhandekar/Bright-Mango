import { useNavigate, useParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SessionsPage } from '@/features/auth/SessionsPage'
import { ProfilePage } from '@/features/dashboard/ProfilePage'

/** Student settings — /settings/profile and /settings/sessions render as tabs. */
export function StudentSettingsPage() {
  const { tab = 'profile' } = useParams()
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-2xl">
      <Tabs value={tab} onValueChange={(next) => navigate(`/settings/${next}`, { replace: true })}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="sessions">Devices</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="pt-4">
          <ProfilePage />
        </TabsContent>
        <TabsContent value="sessions" className="pt-4">
          <SessionsPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}
