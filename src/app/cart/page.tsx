import CartPageClient from '@/components/cart/CartPageClient'

export default function Page() {
  return (
    <main className="container mx-auto py-12">
      <h1 className="text-2xl font-semibold mb-6">Shopping Cart</h1>
      <CartPageClient />
    </main>
  )
}
