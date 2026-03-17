import { useTranslations } from 'next-intl'

export default function ReturnsPage() {
    const t = useTranslations('staticPages.returns')

    return (
        <div className="max-w-4xl mx-auto py-16 px-4">
            <h1 className="text-3xl font-bold mb-4">{t('title')}</h1>
            <p className="text-sm text-gray-400 mb-8">{t('lastUpdated')}</p>
            <div className="prose max-w-none text-gray-600 space-y-6">
                <p>{t('intro')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('h14DayReturns')}</h2>
                <p>{t('p14DayReturns')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hConditions')}</h2>
                <p>{t('pConditions')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hProcess')}</h2>
                <p>{t('pProcess')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hRestockingFee')}</h2>
                <p>{t('pRestockingFee')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hRefunds')}</h2>
                <p>{t('pRefunds')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hB2BReturns')}</h2>
                <p>{t('pB2BReturns')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hDamaged')}</h2>
                <p>{t('pDamaged')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hNonEUReturns')}</h2>
                <p>{t('pNonEUReturns')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hWarranty')}</h2>
                <p>{t('pWarranty')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hWarrantyClaims')}</h2>
                <p>{t('pWarrantyClaims')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hExclusions')}</h2>
                <p>{t('pExclusions')}</p>
            </div>
        </div>
    )
}
