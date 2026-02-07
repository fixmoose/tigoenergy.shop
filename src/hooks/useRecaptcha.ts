'use client'

import { useEffect, useState, useRef } from 'react'

declare global {
    interface Window {
        grecaptcha: any;
    }
}

export function useRecaptcha() {
    const [token, setToken] = useState<string | null>(null)
    const recaptchaRef = useRef<HTMLDivElement>(null)
    const widgetId = useRef<number | null>(null)
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

    useEffect(() => {
        if (typeof window === 'undefined') return

        if (!siteKey) {
            console.error('reCAPTCHA site key is missing! Set NEXT_PUBLIC_RECAPTCHA_SITE_KEY in your environment.')
            return
        }

        const renderRecaptcha = () => {
            if (window.grecaptcha && recaptchaRef.current && widgetId.current === null) {
                widgetId.current = window.grecaptcha.render(recaptchaRef.current, {
                    sitekey: siteKey,
                    size: 'invisible',
                    badge: 'bottomright',
                    callback: (token: string) => {
                        setToken(token)
                    },
                })
            }
        }

        if (!window.grecaptcha) {
            if (!document.getElementById('recaptcha-script')) {
                const script = document.createElement('script')
                script.id = 'recaptcha-script'
                script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`
                script.async = true
                script.defer = true
                document.head.appendChild(script)
            }

            const check = setInterval(() => {
                if (window.grecaptcha?.ready) {
                    window.grecaptcha.ready(() => {
                        renderRecaptcha()
                    })
                    clearInterval(check)
                }
            }, 100)
        } else {
            window.grecaptcha.ready(() => {
                renderRecaptcha()
            })
        }
    }, [siteKey])

    const resetRecaptcha = () => {
        if (typeof window !== 'undefined' && window.grecaptcha) {
            if (widgetId.current !== null) {
                window.grecaptcha.reset(widgetId.current)
            }
            setToken(null)
        }
    }

    const execute = (action: string = 'submit'): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (!siteKey) {
                reject(new Error('reCAPTCHA site key is missing'))
                return
            }

            if (typeof window !== 'undefined' && window.grecaptcha) {
                window.grecaptcha.ready(async () => {
                    try {
                        const token = await window.grecaptcha.execute(siteKey, { action })
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
