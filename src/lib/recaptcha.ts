export async function verifyRecaptcha(token: string | null) {
    if (!token) {
        return { success: false, error: 'reCAPTCHA token is missing' }
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY
    if (!secretKey) {
        console.error('RECAPTCHA_SECRET_KEY is not defined')
        return { success: false, error: 'reCAPTCHA configuration error' }
    }

    try {
        const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `secret=${secretKey}&response=${token}`,
        })

        const data = await response.json()
        return {
            success: data.success,
            score: data.score, // Only for v3, but included for completeness
            error: data['error-codes'] ? data['error-codes'][0] : null
        }
    } catch (error) {
        console.error('reCAPTCHA verification error:', error)
        return { success: false, error: 'Failed to verify reCAPTCHA' }
    }
}
