const UNIONE_API_URL = 'https://us1.unione.io/en/transactional/api/v1/email/send.json'

if (!process.env.UNIONE_API_KEY) {
    console.warn('UNIONE_API_KEY is not set — emails will not be sent.')
}

interface SendEmailParams {
    from: string
    to: string
    subject: string
    html: string
}

export async function sendEmail({ from, to, subject, html }: SendEmailParams) {
    const apiKey = process.env.UNIONE_API_KEY
    if (!apiKey) {
        console.error('UNIONE_API_KEY is not configured, skipping email send.')
        return
    }

    // Parse "Name <email>" format
    const fromMatch = from.match(/^(.+?)\s*<(.+?)>$/)
    const fromEmail = fromMatch ? fromMatch[2] : from
    const fromName = fromMatch ? fromMatch[1].trim() : undefined

    const body = {
        message: {
            recipients: [{ email: to }],
            body: { html },
            subject,
            from_email: fromEmail,
            ...(fromName && { from_name: fromName }),
        },
    }

    const response = await fetch(UNIONE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-API-KEY': apiKey,
        },
        body: JSON.stringify(body),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(`UniOne email error: ${error.message || response.statusText}`)
    }

    return response.json()
}
