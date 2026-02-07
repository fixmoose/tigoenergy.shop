'use client'

import { useEffect, useState, useRef } from 'react'

declare global {
    interface Window {
        grecaptcha: {
            enterprise: any;
        };
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

        if (!siteKey) {
            console.error('reCAPTCHA site key is missing! Check your environment variables (NEXT_PUBLIC_RECAPTCHA_SITE_KEY).')
        }

        const renderRecaptcha = () => {
            if (window.grecaptcha?.enterprise && recaptchaRef.current && widgetId.current === null) {
                widgetId.current = window.grecaptcha.enterprise.render(recaptchaRef.current, {
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

        if (!window.grecaptcha?.enterprise) {
            if (!document.getElementById('recaptcha-script')) {
                const script = document.createElement('script')
                script.id = 'recaptcha-script'
                // Include siteKey in URL as per Enterprise recommendation
                script.src = `https://www.google.com/recaptcha/enterprise.js?render=${siteKey}&onload=onRecaptchaLoad`
                script.async = true
                script.defer = true
                document.head.appendChild(script)

                window.onRecaptchaLoad = renderRecaptcha
            } else {
                const check = setInterval(() => {
                    if (window.grecaptcha?.enterprise) {
                        renderRecaptcha()
                        clearInterval(check)
                    }
                }, 100)
            }
        } else if (window.grecaptcha?.enterprise) {
            renderRecaptcha()
        }
    }, [])

    const resetRecaptcha = () => {
        if (typeof window !== 'undefined' && window.grecaptcha?.enterprise && widgetId.current !== null) {
            window.grecaptcha.enterprise.reset(widgetId.current)
            setToken(null)
        }
    }

    const execute = (): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (typeof window !== 'undefined' && window.grecaptcha?.enterprise && widgetId.current !== null) {
                resolver.current = resolve
                window.grecaptcha.enterprise.execute(widgetId.current)
            } else {
                reject(new Error('reCAPTCHA not ready'))
            }
        })
    }

    return { recaptchaRef, token, resetRecaptcha, execute }
}
