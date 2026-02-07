'use client'

import { useEffect, useState, useRef } from 'react'

declare global {
    interface Window {
        grecaptcha: any;
        onRecaptchaLoad: () => void;
    }
}

export function useRecaptcha() {
    const [token, setToken] = useState<string | null>(null)
    const recaptchaRef = useRef<HTMLDivElement>(null)
    const widgetId = useRef<number | null>(null)
    const resolver = useRef<((token: string) => void) | null>(null)

    useEffect(() => {
        if (typeof window === 'undefined') return

        const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

        const renderRecaptcha = () => {
            if (window.grecaptcha && recaptchaRef.current && widgetId.current === null) {
                widgetId.current = window.grecaptcha.render(recaptchaRef.current, {
                    sitekey: siteKey,
                    size: 'invisible', // Explicitly support invisible
                    callback: (token: string) => {
                        setToken(token)
                        if (resolver.current) {
                            resolver.current(token)
                            resolver.current = null
                        }
                    },
                    'expired-callback': () => {
                        setToken(null)
                    },
                })
            }
        }

        if (!window.grecaptcha) {
            if (!document.getElementById('recaptcha-script')) {
                const script = document.createElement('script')
                script.id = 'recaptcha-script'
                script.src = 'https://www.google.com/recaptcha/api.js?render=explicit'
                script.async = true
                script.defer = true
                document.head.appendChild(script)

                window.onRecaptchaLoad = renderRecaptcha
            } else {
                const check = setInterval(() => {
                    if (window.grecaptcha) {
                        renderRecaptcha()
                        clearInterval(check)
                    }
                }, 100)
            }
        } else {
            renderRecaptcha()
        }
    }, [])

    const resetRecaptcha = () => {
        if (typeof window !== 'undefined' && window.grecaptcha && widgetId.current !== null) {
            window.grecaptcha.reset(widgetId.current)
            setToken(null)
        }
    }

    const execute = (): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (typeof window !== 'undefined' && window.grecaptcha && widgetId.current !== null) {
                resolver.current = resolve
                window.grecaptcha.execute(widgetId.current)
            } else {
                reject(new Error('reCAPTCHA not ready'))
            }
        })
    }

    return { recaptchaRef, token, resetRecaptcha, execute }
}
