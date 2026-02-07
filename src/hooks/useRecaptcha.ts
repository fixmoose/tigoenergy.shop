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

    useEffect(() => {
        if (typeof window === 'undefined') return

        const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6LedhWMsAAAAAKBY-ybP74GCk5TVxrgVzMX0CPrD'

        if (!siteKey) {
            console.error('reCAPTCHA site key is missing! Check your environment variables (NEXT_PUBLIC_RECAPTCHA_SITE_KEY).')
        }

        const renderRecaptcha = () => {
            // Only render explicit widget if a ref is provided and not already rendered
            if (window.grecaptcha?.enterprise && recaptchaRef.current && widgetId.current === null) {
                widgetId.current = window.grecaptcha.enterprise.render(recaptchaRef.current, {
                    sitekey: siteKey,
                    size: 'invisible',
                    badge: 'bottomright',
                    callback: (token: string) => {
                        setToken(token)
                    },
                })
            }
        }

        if (!window.grecaptcha?.enterprise) {
            if (!document.getElementById('recaptcha-script')) {
                const script = document.createElement('script')
                script.id = 'recaptcha-script'
                script.src = `https://www.google.com/recaptcha/enterprise.js?render=${siteKey}`
                script.async = true
                script.defer = true
                document.head.appendChild(script)

                // The Enterprise script handles initialization; we just wait for it.
                const check = setInterval(() => {
                    if (window.grecaptcha?.enterprise) {
                        renderRecaptcha()
                        clearInterval(check)
                    }
                }, 100)
            } else {
                const check = setInterval(() => {
                    if (window.grecaptcha?.enterprise) {
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
        if (typeof window !== 'undefined' && window.grecaptcha?.enterprise) {
            if (widgetId.current !== null) {
                window.grecaptcha.enterprise.reset(widgetId.current)
            }
            setToken(null)
        }
    }

    const execute = (action: string = 'submit'): Promise<string> => {
        return new Promise((resolve, reject) => {
            const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6LdKhWMsAAAAAJYZR9_phXUq7XGZhtipLKb_f5Z3'

            if (typeof window !== 'undefined' && window.grecaptcha?.enterprise) {
                // Enterprise Recommended: Use siteKey directly for programmatic execution
                window.grecaptcha.enterprise.ready(async () => {
                    try {
                        const token = await window.grecaptcha.enterprise.execute(siteKey, { action })
                        setToken(token)
                        resolve(token)
                    } catch (err) {
                        console.error('reCAPTCHA execution failed:', err)
                        reject(err)
                    }
                })
            } else {
                reject(new Error('reCAPTCHA not ready'))
            }
        })
    }

    return { recaptchaRef, token, resetRecaptcha, execute }
}
