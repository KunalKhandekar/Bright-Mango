import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { GraduationCap, LayoutDashboard, LogOut, Menu, Settings, Shield, User } from 'lucide-react'
import { toast } from 'sonner'
import { logout } from '@/api/auth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'text-sm font-medium transition-colors hover:text-foreground',
    isActive ? 'text-foreground' : 'text-muted-foreground',
  )
}

export function StudentLayout() {
  const { user, status, clearUser } = useAuthStore()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      // Session may already be gone; clear locally regardless.
    }
    clearUser()
    toast.success('Signed out')
    navigate('/')
  }

  const authedLinks = (
    <>
      <NavLink to="/" className={navLinkClass} onClick={() => setMenuOpen(false)}>
        Courses
      </NavLink>
      {status === 'authed' && (
        <NavLink to="/dashboard" className={navLinkClass} onClick={() => setMenuOpen(false)}>
          My Learning
        </NavLink>
      )}
    </>
  )

  return (
    <div className="bg-background flex min-h-svh flex-col">
      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <GraduationCap className="text-primary size-5.5" />
            <span>BrightMango</span>
          </Link>

          <nav className="ml-6 hidden items-center gap-6 md:flex">{authedLinks}</nav>

          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            {status === 'authed' && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <UserAvatar name={user.name} email={user.email} avatar={user.avatar} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <p className="truncate text-sm font-medium">{user.name || 'Learner'}</p>
                    <p className="text-muted-foreground truncate text-xs">{user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {user.role === 'mentor' && (
                    <DropdownMenuItem onClick={() => navigate('/admin')}>
                      <Shield className="size-4" /> Admin panel
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                    <LayoutDashboard className="size-4" /> My learning
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings/profile')}>
                    <User className="size-4" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings/sessions')}>
                    <Settings className="size-4" /> Devices
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="size-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : status === 'guest' ? (
              <Button size="sm" onClick={() => navigate('/login')}>
                Sign in
              </Button>
            ) : null}

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <nav className="mt-8 flex flex-col gap-4 px-4">{authedLinks}</nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t py-6">
        <div className="text-muted-foreground mx-auto w-full max-w-6xl px-4 text-sm">
          © {new Date().getFullYear()} BrightMango
        </div>
      </footer>
    </div>
  )
}
