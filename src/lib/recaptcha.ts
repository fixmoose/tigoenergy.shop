export async function verifyRecaptcha(token: string | null, action: string = 'any') {
    if (!token) {
        return { success: false, error: 'reCAPTCHA token is missing' }
    }

    // NEW: Use the Project ID provided by the user
    const projectId = process.env.RECAPTCHA_PROJECT_ID || 'tigoenergy-shop'
    const apiKey = process.env.RECAPTCHA_API_KEY
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6LedhWMsAAAAAKBY-ybP74GCk5TVxrgVzMX0CPrD'

    // If no API Key is provided for Google Cloud, we cannot use the Enterprise Assessment API.
    // In that case, we fallback to the legacy verification (which still works for Enterprise keys).
    if (!apiKey) {
        console.warn('RECAPTCHA_API_KEY is missing. Falling back to legacy siteverify (recommended for easier Vercel setup).')
        const secretKey = process.env.RECAPTCHA_SECRET_KEY || '6LdKhWMsAAAAACAe9oKxIks-4WjZyIsGKu7gMs5_'

        try {
            const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `secret=${secretKey}&response=${token}`,
            })
            const data = await response.json()

            if (!data.success) {
                console.error('reCAPTCHA siteverify failed:', data['error-codes'])
            }

            return {
                success: data.success,
                error: data['error-codes'] ? data['error-codes'][0] : null
            }
        } catch (error) {
            console.error('Legacy reCAPTCHA verification error:', error)
            return { success: false, error: 'Failed to verify reCAPTCHA' }
        }
    }

    // reCAPTCHA Enterprise Assessment API (The "New" Way)
    try {
        const response = await fetch(
            `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: {
                        token: token,
                        siteKey: siteKey,
                        expectedAction: action
                    }
                })
            }
        )

        const data = await response.json()

        if (data.error) {
            console.error('reCAPTCHA Enterprise API Error:', data.error)
            // If the Enterprise API fails (e.g. key disabled), return false but log it.
            return { success: false, error: data.error.message }
        }

        // Check token validity
        const isValid = data.tokenProperties?.valid === true
        const reason = data.tokenProperties?.invalidReason

        if (!isValid) {
            console.error(`reCAPTCHA Token Invalid: ${reason}`)
        }

        return {
            success: isValid,
            score: data.riskAnalysis?.score,
            reasons: data.riskAnalysis?.reasons,
            action: data.tokenProperties?.action,
            error: isValid ? null : (reason || 'invalid-token')
        }
    } catch (error) {
        console.error('reCAPTCHA Enterprise verification error:', error)
        return { success: false, error: 'Failed to verify reCAPTCHA' }
    }
}
