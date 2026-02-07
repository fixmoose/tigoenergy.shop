export async function verifyRecaptcha(token: string | null, action: string = 'any') {
    if (!token) {
        return { success: false, error: 'reCAPTCHA token is missing' }
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY
    if (!secretKey) {
        console.error('RECAPTCHA_SECRET_KEY is not set in environment variables.')
        return { success: false, error: 'reCAPTCHA server configuration error' }
    }

    try {
        const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${secretKey}&response=${token}`,
        })
        const data = await response.json()

        if (!data.success) {
            console.error('reCAPTCHA verification failed:', data['error-codes'])
        }

        // Verify action matches if one was specified (prevents token reuse across forms)
        if (data.success && action !== 'any' && data.action && data.action !== action) {
            console.error(`reCAPTCHA action mismatch: expected "${action}", got "${data.action}"`)
            return { success: false, error: 'reCAPTCHA action mismatch' }
        }

        return {
            success: data.success,
            score: data.score,
            action: data.action,
            error: data['error-codes'] ? data['error-codes'][0] : null
        }
    } catch (error) {
        console.error('reCAPTCHA verification error:', error)
        return { success: false, error: 'Failed to verify reCAPTCHA' }
    }
}
