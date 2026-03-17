import { useTranslations } from 'next-intl'

export default function CookiesPage() {
    const t = useTranslations('staticPages.cookies')

    return (
        <div className="max-w-4xl mx-auto py-16 px-4">
            <h1 className="text-3xl font-bold mb-4">{t('title')}</h1>
            <p className="text-sm text-gray-400 mb-8">{t('lastUpdated')}</p>
            <div className="prose max-w-none text-gray-600 space-y-6">
                <p>{t('intro')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hWhat')}</h2>
                <p>{t('pWhat')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hTypes')}</h2>
                <p>{t('pTypes')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hEssential')}</h2>
                <p>{t('pEssential')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hAnalytics')}</h2>
                <p>{t('pAnalytics')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hMarketing')}</h2>
                <p>{t('pMarketing')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hThirdParty')}</h2>
                <p>{t('pThirdParty')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hControl')}</h2>
                <p>{t('pControl')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hImpact')}</h2>
                <p>{t('pImpact')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hChanges')}</h2>
                <p>{t('pChanges')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hContact')}</h2>
                <p>{t('pContact')}</p>
            </div>
        </div>
    )
}
