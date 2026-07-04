import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AdminLayout } from '@/layouts/AdminLayout'
import { StudentLayout } from '@/layouts/StudentLayout'
import { RedirectIfAuthed, RequireAuth, RequireMentor } from '@/routes/guards'
import { HomePage } from '@/features/catalog/HomePage'
import { CourseDetailPage } from '@/features/catalog/CourseDetailPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { CheckoutPage } from '@/features/checkout/CheckoutPage'
import { LearnPage } from '@/features/learn/LearnPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { OrdersPage } from '@/features/dashboard/OrdersPage'
import { StudentSettingsPage } from '@/features/dashboard/StudentSettingsPage'
import { AdminDashboardPage } from '@/features/admin/overview/AdminDashboardPage'
import { AdminCoursesPage } from '@/features/admin/courses/AdminCoursesPage'
import { CourseBuilderPage } from '@/features/admin/courses/CourseBuilderPage'
import { StudentsPage } from '@/features/admin/students/StudentsPage'
import { StudentDetailPage } from '@/features/admin/students/StudentDetailPage'
import { BlacklistPage } from '@/features/admin/students/BlacklistPage'
import { CouponsPage } from '@/features/admin/coupons/CouponsPage'
import { CommentsModerationPage } from '@/features/admin/comments/CommentsModerationPage'
import { CampaignsPage } from '@/features/admin/campaigns/CampaignsPage'
import { CampaignComposePage } from '@/features/admin/campaigns/CampaignComposePage'
import { CampaignDetailPage } from '@/features/admin/campaigns/CampaignDetailPage'
import { AuditLogsPage } from '@/features/admin/audit/AuditLogsPage'
import { AdminSettingsPage } from '@/features/admin/settings/AdminSettingsPage'
import { NotFoundPage } from '@/features/misc/NotFoundPage'

export const router = createBrowserRouter([
  {
    element: <StudentLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/courses/:slug', element: <CourseDetailPage /> },
      {
        element: <RedirectIfAuthed />,
        children: [{ path: '/login', element: <LoginPage /> }],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: '/checkout/:slug', element: <CheckoutPage /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/orders', element: <OrdersPage /> },
          { path: '/settings', element: <Navigate to="/settings/profile" replace /> },
          { path: '/settings/:tab', element: <StudentSettingsPage /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      { path: '/learn/:courseId', element: <LearnPage /> },
      { path: '/learn/:courseId/lessons/:lessonId', element: <LearnPage /> },
    ],
  },
  {
    element: <RequireMentor />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: '/admin', element: <AdminDashboardPage /> },
          { path: '/admin/courses', element: <AdminCoursesPage /> },
          { path: '/admin/courses/:id', element: <CourseBuilderPage /> },
          { path: '/admin/students', element: <StudentsPage /> },
          { path: '/admin/students/:id', element: <StudentDetailPage /> },
          { path: '/admin/blacklist', element: <BlacklistPage /> },
          { path: '/admin/coupons', element: <CouponsPage /> },
          { path: '/admin/comments', element: <CommentsModerationPage /> },
          { path: '/admin/campaigns', element: <CampaignsPage /> },
          { path: '/admin/campaigns/new', element: <CampaignComposePage /> },
          { path: '/admin/campaigns/:id', element: <CampaignDetailPage /> },
          { path: '/admin/audit', element: <AuditLogsPage /> },
          { path: '/admin/settings', element: <AdminSettingsPage /> },
          { path: '/admin/*', element: <Navigate to="/admin" replace /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
