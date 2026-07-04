import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { useAuthBootstrap } from '@/hooks/use-auth-bootstrap'
import { queryClient } from '@/lib/query-client'
import { router } from '@/routes'

function AppRouter() {
  useAuthBootstrap()
  return <RouterProvider router={router} />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppRouter />
        <Toaster position="top-center" richColors />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
