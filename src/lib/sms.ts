
if (!process.env.INFOBIP_API_KEY) {
    console.warn('INFOBIP_API_KEY is not set — SMS will not be sent.')
}

interface SendSMSParams {
    to: string
    text: string
    from?: string
}

/**
 * Sends an SMS using Infobip gateway.
 */
export async function sendSMS({ to, text, from = 'TigoEnergy' }: SendSMSParams) {
    const apiKey = process.env.INFOBIP_API_KEY
    const baseUrl = process.env.INFOBIP_BASE_URL || '8vgvx9.api.infobip.com'

    if (!apiKey) {
        console.error('INFOBIP_API_KEY is not configured, skipping SMS send.')
        return { success: false, error: 'API key not configured' }
    }

    // Clean phone number (Infobip likes international format without +)
    let cleanPhone = to.replace(/\+/g, '').replace(/\s/g, '')

    try {
        const response = await fetch(`https://${baseUrl}/sms/1/text/single`, {
            method: 'POST',
            headers: {
                'Authorization': `App ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                from,
                to: cleanPhone,
                text,
            }),
        })

        const data = await response.json()

        if (!response.ok) {
            console.error('Infobip SMS failure:', data)
            throw new Error(`Infobip error: ${data.detail || response.statusText}`)
        }

        return { success: true, data }
    } catch (error) {
        console.error('Failed to send SMS via Infobip:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
}
