'use server'

import { verifyRecaptcha } from '@/lib/recaptcha'

export async function testVerifyToken(token: string, action: string) {
    try {
        const result = await verifyRecaptcha(token, action)
        return result
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
