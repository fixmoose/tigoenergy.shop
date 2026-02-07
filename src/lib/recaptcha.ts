export async function verifyRecaptcha(token: string | null) {
    if (!token) {
        return { success: false, error: 'reCAPTCHA token is missing' }
    }

    const projectId = process.env.RECAPTCHA_PROJECT_ID
    const apiKey = process.env.RECAPTCHA_API_KEY
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

    // Fallback to legacy verification if Enterprise config is missing
    if (!projectId || !apiKey) {
        const secretKey = process.env.RECAPTCHA_SECRET_KEY
        if (!secretKey) {
            console.error('Neither reCAPTCHA Enterprise nor Legacy Secret Key is defined')
            return { success: false, error: 'reCAPTCHA configuration error' }
        }

        try {
            const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `secret=${secretKey}&response=${token}`,
            })
            const data = await response.json()
            return {
                success: data.success,
                error: data['error-codes'] ? data['error-codes'][0] : null
            }
        } catch (error) {
            console.error('Legacy reCAPTCHA verification error:', error)
            return { success: false, error: 'Failed to verify reCAPTCHA' }
        }
    }

    // reCAPTCHA Enterprise Verification
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
                        expectedAction: 'any' // Optional: tune this per-action if needed
                    }
                })
            }
        )

        const data = await response.json()

        if (data.error) {
            console.error('reCAPTCHA Enterprise API Error:', data.error)
            return { success: false, error: data.error.message }
        }

        // Enterprise success criteria: token must be valid and score high enough (if v3/score-based)
        // For v2 Invisible conversion, we check if the token is valid.
        const isValid = data.tokenProperties?.valid === true

        return {
            success: isValid,
            score: data.riskAnalysis?.score,
            reasons: data.riskAnalysis?.reasons,
            error: isValid ? null : 'invalid-token'
        }
    } catch (error) {
        console.error('reCAPTCHA Enterprise verification error:', error)
        return { success: false, error: 'Failed to verify reCAPTCHA' }
    }
}
