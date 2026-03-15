import { useTranslations } from 'next-intl'

export default function ReturnsPage() {
    const t = useTranslations('staticPages.returns')

    return (
        <div className="max-w-4xl mx-auto py-16 px-4">
            <h1 className="text-3xl font-bold mb-8">{t('title')}</h1>
            <div className="prose max-w-none text-gray-600">
                <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-4">{t('h14DayReturns')}</h2>
                <p>{t('p14DayReturns')}</p>
                <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-4">{t('hRestockingFee')}</h2>
                <p>{t('pRestockingFee')}</p>
                <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-4">{t('hB2BReturns')}</h2>
                <p>{t('pB2BReturns')}</p>
                <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-4">{t('hNonEUReturns')}</h2>
                <p>{t('pNonEUReturns')}</p>
                <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-4">{t('hWarranty')}</h2>
                <p>{t('pWarranty')}</p>
            </div>
        </div>
    )
}
