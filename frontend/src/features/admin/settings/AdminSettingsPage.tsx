import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/PageHeader'
import { SessionsPage } from '@/features/auth/SessionsPage'
import { ProfilePage } from '@/features/dashboard/ProfilePage'

export function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your mentor account." />
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="pt-4">
          <ProfilePage />
        </TabsContent>
        <TabsContent value="devices" className="pt-4">
          <SessionsPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}
