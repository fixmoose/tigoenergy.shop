import type { Metadata } from 'next'
import { generateStaticPageMetadata } from '@/lib/utils/static-page-metadata'

export async function generateMetadata(): Promise<Metadata> {
    return generateStaticPageMetadata('contact')
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
    return children
}
