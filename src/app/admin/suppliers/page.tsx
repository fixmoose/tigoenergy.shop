import { getSuppliers } from '@/app/actions/suppliers'
import SupplierList from '@/components/admin/SupplierList'

export default async function AdminSuppliersPage() {
    const suppliers = await getSuppliers()

    return (
        <div className="p-6">
            <SupplierList suppliers={suppliers} />
        </div>
    )
}
