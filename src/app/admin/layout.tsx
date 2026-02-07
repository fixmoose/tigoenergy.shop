import AdminNavigation from '@/components/admin/AdminNavigation'
import { cookies } from 'next/headers'

export const metadata = {
  title: 'Admin - Tigo Energy',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const isAdmin = cookieStore.get('tigo-admin')?.value === '1'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-8xl mx-auto px-6 py-6">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          {isAdmin && <AdminNavigation />}
        </header>
        <main>{children}</main>
      </div>
    </div>
  )
}
