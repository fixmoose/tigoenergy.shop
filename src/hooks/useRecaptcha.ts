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

    useEffect(() => {
        if (typeof window === 'undefined') return

        const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

        const renderRecaptcha = () => {
            if (window.grecaptcha && recaptchaRef.current && !recaptchaRef.current.innerHTML) {
                window.grecaptcha.render(recaptchaRef.current, {
                    sitekey: siteKey,
                    callback: (token: string) => setToken(token),
                    'expired-callback': () => setToken(null),
                })
            }
        }

        if (!window.grecaptcha) {
            // Check if script already exists
            if (!document.getElementById('recaptcha-script')) {
                const script = document.createElement('script')
                script.id = 'recaptcha-script'
                script.src = 'https://www.google.com/recaptcha/api.js?render=explicit'
                script.async = true
                script.defer = true
                document.head.appendChild(script)

                window.onRecaptchaLoad = renderRecaptcha
            } else {
                // Script is there but grecaptcha not ready, wait for it
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
        if (typeof window !== 'undefined' && window.grecaptcha) {
            window.grecaptcha.reset()
            setToken(null)
        }
    }

    return { recaptchaRef, token, resetRecaptcha }
}
