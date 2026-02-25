import { useTranslations } from 'next-intl'

export default function TermsOfServicePage() {
    const t = useTranslations('staticPages.terms')

    return (
        <div className="max-w-4xl mx-auto py-16 px-4">
            <h1 className="text-3xl font-bold mb-8">{t('title')}</h1>
            <div className="prose max-w-none text-gray-600">
                <p className="mb-6">{t('lastUpdated')}</p>
                <p className="mb-6">{t('intro')}</p>
                <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-4">{t('h1')}</h2>
                <p className="mb-6">{t('p1')}</p>
                <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-4">{t('h2')}</h2>
                <p className="mb-6">{t('p2')}</p>
            </div>
        </div>
    )
}
