import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Driver Portal — Initra Energija',
    robots: { index: false, follow: false },
}

export default function DriverLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
