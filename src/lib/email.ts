import fs from 'fs/promises'
import path from 'path'

const UNIONE_API_URL = 'https://us1.unione.io/en/transactional/api/v1/email/send.json'

if (!process.env.UNIONE_API_KEY) {
    console.warn('UNIONE_API_KEY is not set — emails will not be sent.')
}

interface SendEmailParams {
    from?: string
    to: string
    subject: string
    html?: string
    templateId?: string
    substitutions?: Record<string, string>
    skipUnsubscribe?: boolean
    orderId?: string
    emailType?: string
}

export async function sendEmail({
    from = 'Tigo e-Shop Admin Team <support@tigoenergy.shop>',
    to,
    subject,
    html,
    templateId,
    substitutions,
    skipUnsubscribe = false,
    orderId,
    emailType,
}: SendEmailParams) {
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
            recipients: [{
                email: to,
                ...(substitutions && { substitutions })
            }],
            ...(html && { body: { html } }),
            ...(templateId && { template_id: templateId }),
            subject,
            from_email: fromEmail,
            ...(fromName && { from_name: fromName }),
            // Note: skip_unsubscribe requires UniOne 'allow_skip_unsubscribe' flag — disabled
        },
    }

    let responseData: any = null
    let errorMsg: string | null = null

    try {
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
            const errBody = await response.json().catch(() => ({}))
            errorMsg = errBody.message || response.statusText
            throw new Error(`UniOne email error: ${errorMsg}`)
        }

        responseData = await response.json()
    } catch (err: any) {
        errorMsg = errorMsg || err.message
        await logEmail({ orderId, emailType, recipient: to, subject, status: 'failed', error: errorMsg })
        throw err
    }

    await logEmail({
        orderId, emailType, recipient: to, subject,
        status: 'sent',
        unioneJobId: responseData?.job_id,
    })

    return responseData
}

async function logEmail(params: {
    orderId?: string
    emailType?: string
    recipient: string
    subject: string
    status: string
    unioneJobId?: string
    error?: string | null
}) {
    try {
        const { createAdminClient } = await import('@/lib/supabase/server')
        const supabase = await createAdminClient()
        await supabase.from('email_logs').insert({
            order_id: params.orderId || null,
            email_type: params.emailType || 'unknown',
            recipient: params.recipient,
            subject: params.subject,
            status: params.status,
            unione_job_id: params.unioneJobId || null,
            error: params.error || null,
        })
    } catch (logErr) {
        console.error('Failed to log email:', logErr)
    }
}

/**
 * Sends an admin/internal notification to all configured admin addresses.
 * Reads MASTER_ADMIN_EMAIL and ADMIN_NOTIFY_EMAILS (comma-separated) env vars.
 * Always includes support@tigoenergy.shop as fallback.
 */
export async function notifyAdmins({ subject, html }: { subject: string; html: string }) {
    const addresses = new Set<string>()

    // Primary admin email
    if (process.env.MASTER_ADMIN_EMAIL) addresses.add(process.env.MASTER_ADMIN_EMAIL)

    // Extra notification emails (comma-separated)
    if (process.env.ADMIN_NOTIFY_EMAILS) {
        process.env.ADMIN_NOTIFY_EMAILS.split(',').map(e => e.trim()).filter(Boolean).forEach(e => addresses.add(e))
    }

    // Fallback: always include support address
    addresses.add('support@tigoenergy.shop')

    const sends = Array.from(addresses).map(to =>
        sendEmail({ to, subject, html, skipUnsubscribe: true, emailType: 'admin_notification' }).catch(err =>
            console.error(`Failed to send admin notification to ${to}:`, err)
        )
    )
    await Promise.allSettled(sends)
}

/**
 * Sends a transactional email using a UniOne template ID.
 */
export async function sendTemplateEmail({ from, to, subject, templateId, substitutions, skipUnsubscribe = false }: Omit<SendEmailParams, 'html'> & { templateId: string }) {
    return sendEmail({ from, to, subject, templateId, substitutions, skipUnsubscribe })
}

/**
 * Renders an HTML email template by replacing placeholders with data.
 * Supports multi-language by looking into src/lib/email/templates/[locale]/
 * Falls back to 'en' if the localized version is missing.
 * Also injects translations from src/messages/[locale].json
 */
export async function renderTemplate(templateName: string, data: Record<string, string>, locale: string = 'en') {
    try {
        const templatesDir = path.join(process.cwd(), 'src/lib/email/templates')
        const messagesPath = path.join(process.cwd(), 'src/messages', `${locale}.json`)
        const enMessagesPath = path.join(process.cwd(), 'src/messages', 'en.json')

        let templatePath = path.join(templatesDir, locale, `${templateName}.html`)

        // Fallback to 'en' if localized template doesn't exist
        try {
            await fs.access(templatePath)
        } catch {
            templatePath = path.join(templatesDir, 'en', `${templateName}.html`)
        }

        let html = await fs.readFile(templatePath, 'utf8')

        // Load translations
        let translations: any = {}
        try {
            const raw = await fs.readFile(messagesPath, 'utf8')
            translations = JSON.parse(raw)
        } catch {
            const raw = await fs.readFile(enMessagesPath, 'utf8')
            translations = JSON.parse(raw)
        }

        // Flatten translations for easy replacement (e.g., {{t_common_addToCart}})
        const flatten = (obj: any, prefix = 't_') => {
            let res: Record<string, string> = {}
            for (const key in obj) {
                const fullKey = prefix + key
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    Object.assign(res, flatten(obj[key], fullKey + '_'))
                } else {
                    res[fullKey] = String(obj[key])
                }
            }
            return res
        }

        const flattenedTranslations = flatten(translations)
        const combinedData = { ...flattenedTranslations, ...data }

        // Replace placeholders like {{name}} or {{t_footer_allRightsReserved}}
        Object.entries(combinedData).forEach(([key, value]) => {
            const placeholder = new RegExp(`{{${key}}}`, 'g')
            html = html.replace(placeholder, value)
        })

        return html
    } catch (error) {
        console.error(`Failed to render template ${templateName} for locale ${locale}:`, error)
        throw new Error(`Email template rendering failed for ${templateName}`)
    }
}

/**
 * Renders a template from the database (document_templates table)
 */
export async function renderDatabaseTemplate(type: string, data: Record<string, string>, locale: string = 'en') {
    const { getPinnedTemplate, replacePlaceholders } = await import('./document-service')

    try {
        const template = await getPinnedTemplate(type, locale)
        if (!template) {
            console.warn(`Template of type ${type} for locale ${locale} not found in DB.`)
            return null
        }

        // Mapping common placeholders to DocumentData fields if needed
        // replacePlaceholders handles simple {key} replacement
        return replacePlaceholders(template.content_html, data as any)
    } catch (error) {
        console.error(`Error rendering database template ${type}:`, error)
        return null
    }
}

/**
 * Loads translations for a specific locale.
 */
export async function getEmailTranslations(locale: string = 'en') {
    const messagesPath = path.join(process.cwd(), 'src/messages', `${locale}.json`)
    const enMessagesPath = path.join(process.cwd(), 'src/messages', 'en.json')

    try {
        const raw = await fs.readFile(messagesPath, 'utf8')
        return JSON.parse(raw)
    } catch {
        const raw = await fs.readFile(enMessagesPath, 'utf8')
        return JSON.parse(raw)
    }
}
