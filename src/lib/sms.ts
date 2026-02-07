const SEVEN_API_URL = 'https://gateway.seven.io/api/sms'

if (!process.env.SEVEN_API_KEY) {
    console.warn('SEVEN_API_KEY is not set — SMS will not be sent.')
}

interface SendSMSParams {
    to: string
    text: string
    from?: string
}

/**
 * Sends an SMS using seven.io gateway.
 */
export async function sendSMS({ to, text, from = 'TigoEnergy' }: SendSMSParams) {
    const apiKey = process.env.SEVEN_API_KEY
    if (!apiKey) {
        console.error('SEVEN_API_KEY is not configured, skipping SMS send.')
        return { success: false, error: 'API key not configured' }
    }

    try {
        const response = await fetch(SEVEN_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': apiKey,
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                to,
                text,
                from,
                json: 1, // Get JSON response
            }),
        })

        const data = await response.json()

        if (!response.ok) {
            throw new Error(`Seven.io error: ${data.error || response.statusText}`)
        }

        // seven.io returns success code 100 for ok
        if (data.success !== '100' && data.success !== 100) {
            console.error('Seven.io SMS failed:', data)
            return { success: false, data }
        }

        return { success: true, data }
    } catch (error) {
        console.error('Failed to send SMS:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
}
