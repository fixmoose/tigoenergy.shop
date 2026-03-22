import { useTranslations } from 'next-intl'
import { generateStaticPageMetadata } from '@/lib/utils/static-page-metadata'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
    return generateStaticPageMetadata('faq')
}

export default function FAQPage() {
    const t = useTranslations('staticPages.faq')

    return (
        <div className="max-w-4xl mx-auto py-16 px-4">
            <h1 className="text-3xl font-bold mb-8">{t('title')}</h1>
            <div className="space-y-6 text-gray-600">
                <div>
                    <h3 className="font-semibold text-gray-900">{t('q1')}</h3>
                    <p>{t('a1')}</p>
                </div>
                <div>
                    <h3 className="font-semibold text-gray-900">{t('q2')}</h3>
                    <p>{t('a2')}</p>
                </div>
            </div>
        </div>
    )
}
