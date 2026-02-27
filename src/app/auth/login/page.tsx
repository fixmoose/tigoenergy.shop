import LoginForm from '@/components/auth/LoginForm'
import { Metadata } from 'next'
import { useTranslations } from 'next-intl'

export const metadata: Metadata = {
    title: 'Sign In | Tigo Energy Shop',
    description: 'Sign in to your Tigo Energy Shop account to manage orders, view pricing, and more.',
}

export default function LoginPage() {
    const t = useTranslations('auth.login')

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-gray-50">
            <div className="mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-700">
                <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">{t('title')}</h1>
                <p className="mt-2 text-gray-500 font-medium">{t('subtitle')}</p>
            </div>

            <LoginForm />
        </div>
    )
}
