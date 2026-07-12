import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  BookOpenCheck,
  FileCode2,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  ScrollText,
  Settings,
  TicketPercent,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { logout } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'

const NAV_ITEMS = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/courses', label: 'Courses', icon: BookOpen },
  { to: '/admin/students', label: 'Students', icon: Users },
  { to: '/admin/enrollments', label: 'Enrollments', icon: BookOpenCheck },
  { to: '/admin/coupons', label: 'Coupons', icon: TicketPercent },
  { to: '/admin/payments', label: 'Income', icon: IndianRupee },
  { to: '/admin/comments', label: 'Comments', icon: MessageSquare },
  { to: '/admin/campaigns', label: 'Campaigns', icon: Mail },
  { to: '/admin/email-templates', label: 'Email templates', icon: FileCode2 },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )
          }
        >
          <Icon className="size-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

export function AdminLayout() {
  const { user, clearUser } = useAuthStore()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      // ignore; clearing locally below
    }
    clearUser()
    toast.success('Signed out')
    navigate('/')
  }

  return (
    <div className="bg-background flex min-h-svh">
      <aside className="bg-sidebar sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Link to="/admin" className="flex items-center gap-2 font-semibold">
            <GraduationCap className="text-primary size-5.5" />
            <span>BrightMango</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <AdminNav />
        </div>
        <div className="border-t p-3">
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm"
          >
            <BookOpen className="size-4" /> View student site
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-3">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="mt-6">
                  <AdminNav onNavigate={() => setMenuOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>

            <span className="text-sm font-medium lg:hidden">Admin</span>

            <div className="ml-auto flex items-center gap-1.5">
              <ThemeToggle />
              <div className="flex items-center gap-2 pl-1">
                <UserAvatar name={user?.name} email={user?.email} avatar={user?.avatar} />
                <span className="hidden text-sm font-medium sm:inline">
                  {user?.name || user?.email}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sign out">
                <LogOut className="size-4.5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
