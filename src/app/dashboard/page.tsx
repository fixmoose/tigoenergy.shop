import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import B2CDashboard from '@/components/dashboard/B2CDashboard'
import B2BDashboard from '@/components/dashboard/B2BDashboard'

export default async function DashboardPage() {
    const supabase = await createClient()

    // 1. Check User Session
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/auth/login')
    }

    // 2. Check Admin Role
    if (user.user_metadata?.role === 'admin') {
        redirect('/admin/products')
    }

    // 3. Fetch Customer Data
    const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', user.id)
        .single()

    if (!customer) {
        // Redirect to welcome page which handles customer creation
        redirect('/auth/welcome')
    }

    // Check if user is B2B
    const isB2B = customer.customer_type === 'b2b'

    // 4. Render Appropriate Dashboard
    return (
        <div className="min-h-screen bg-gray-50 pt-6 pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-8 sr-only">Dashboard</h1>
                {isB2B ? (
                    <B2BDashboard user={user} customer={customer} />
                ) : (
                    <B2CDashboard user={user} customer={customer} />
                )}
            </div>
        </div>
    )
}
