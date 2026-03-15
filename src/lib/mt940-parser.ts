/**
 * MT940 / CAMT.053 bank statement parser.
 * Extracts transactions from standard bank statement files.
 *
 * MT940 structure:
 *   :20: Transaction Reference
 *   :25: Account Identification
 *   :28C: Statement Number
 *   :60F: Opening Balance
 *   :61: Statement Line (transaction)
 *   :86: Information to Account Owner (details)
 *   :62F: Closing Balance
 */

export interface MT940Transaction {
    date: string           // YYYY-MM-DD
    amount: number         // positive = credit, negative = debit
    currency: string
    reference: string      // payment reference / description
    description: string    // full :86: details
    valueDate: string      // YYYY-MM-DD
    bankReference: string
    type: 'credit' | 'debit'
}

export interface MT940Statement {
    accountId: string
    statementNumber: string
    openingBalance: number
    closingBalance: number
    currency: string
    transactions: MT940Transaction[]
}

/**
 * Parse an MT940/STA file content into structured statements.
 */
export function parseMT940(content: string): MT940Statement[] {
    const statements: MT940Statement[] = []
    // Normalize line endings
    const raw = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    // Split into individual statements (each starts with :20:)
    const blocks = raw.split(/(?=:20:)/).filter(b => b.trim().length > 0)

    for (const block of blocks) {
        const stmt: MT940Statement = {
            accountId: '',
            statementNumber: '',
            openingBalance: 0,
            closingBalance: 0,
            currency: 'EUR',
            transactions: [],
        }

        // :25: Account identification
        const accountMatch = block.match(/:25:(.+)/m)
        if (accountMatch) stmt.accountId = accountMatch[1].trim()

        // :28C: Statement number
        const stmtNumMatch = block.match(/:28C?:(.+)/m)
        if (stmtNumMatch) stmt.statementNumber = stmtNumMatch[1].trim()

        // :60F: Opening balance  (C/D)(date)(currency)(amount)
        const openMatch = block.match(/:60[FM]:([CD])(\d{6})([A-Z]{3})([\d,\.]+)/m)
        if (openMatch) {
            stmt.currency = openMatch[3]
            const amount = parseAmount(openMatch[4])
            stmt.openingBalance = openMatch[1] === 'D' ? -amount : amount
        }

        // :62F: Closing balance
        const closeMatch = block.match(/:62[FM]:([CD])(\d{6})([A-Z]{3})([\d,\.]+)/m)
        if (closeMatch) {
            const amount = parseAmount(closeMatch[4])
            stmt.closingBalance = closeMatch[1] === 'D' ? -amount : amount
        }

        // Parse :61: transaction lines and :86: details
        // :61: format: (value date 6)(entry date 4 optional)(C/D or RC/RD)(amount)(type)(reference)
        const transactionPattern = /:61:(\d{6})(\d{4})?([CRD]{1,2})([\d,\.]+)([A-Z]\d{3})([^\n]*)/g
        const infoPattern = /:86:([^]*?)(?=:(?:6[12]|20|25|28|60|62)|$)/g

        const transLines: { match: RegExpExecArray; index: number }[] = []
        let tMatch
        while ((tMatch = transactionPattern.exec(block)) !== null) {
            transLines.push({ match: tMatch, index: tMatch.index })
        }

        const infoLines: { text: string; index: number }[] = []
        let iMatch
        while ((iMatch = infoPattern.exec(block)) !== null) {
            infoLines.push({ text: iMatch[1].trim(), index: iMatch.index })
        }

        for (let i = 0; i < transLines.length; i++) {
            const t = transLines[i].match
            const valueDateStr = t[1]
            const cdIndicator = t[3]
            const amount = parseAmount(t[4])
            const bankRef = t[6]?.trim() || ''

            const isCredit = cdIndicator === 'C' || cdIndicator === 'RC'
            const signedAmount = isCredit ? amount : -amount

            // Find matching :86: line (the one that comes after this :61: and before next :61:)
            let description = ''
            const tIdx = transLines[i].index
            const nextTIdx = i + 1 < transLines.length ? transLines[i + 1].index : block.length

            for (const info of infoLines) {
                if (info.index > tIdx && info.index < nextTIdx) {
                    description = info.text.replace(/\n/g, ' ').trim()
                    break
                }
            }

            // Extract payment reference from :86: details
            // Common patterns: /REF/, SVREF, KREF, order number patterns
            const reference = extractReference(description, bankRef)

            stmt.transactions.push({
                date: parseDate6(valueDateStr),
                valueDate: parseDate6(valueDateStr),
                amount: signedAmount,
                currency: stmt.currency,
                reference,
                description,
                bankReference: bankRef,
                type: isCredit ? 'credit' : 'debit',
            })
        }

        if (stmt.transactions.length > 0 || stmt.accountId) {
            statements.push(stmt)
        }
    }

    return statements
}

/**
 * Parse CAMT.053 XML bank statement format.
 */
export function parseCAMT053(xmlContent: string): MT940Statement[] {
    const statements: MT940Statement[] = []

    // Simple XML parsing without external dependencies
    // Extract <Stmt> blocks
    const stmtBlocks = xmlContent.match(/<Stmt>([\s\S]*?)<\/Stmt>/g) || []

    for (const stmtBlock of stmtBlocks) {
        const stmt: MT940Statement = {
            accountId: '',
            statementNumber: '',
            openingBalance: 0,
            closingBalance: 0,
            currency: 'EUR',
            transactions: [],
        }

        // Account IBAN
        const ibanMatch = stmtBlock.match(/<IBAN>([^<]+)<\/IBAN>/)
        if (ibanMatch) stmt.accountId = ibanMatch[1]

        // Statement ID
        const idMatch = stmtBlock.match(/<Id>([^<]+)<\/Id>/)
        if (idMatch) stmt.statementNumber = idMatch[1]

        // Balances
        const balBlocks = stmtBlock.match(/<Bal>([\s\S]*?)<\/Bal>/g) || []
        for (const bal of balBlocks) {
            const typeMatch = bal.match(/<Cd>([^<]+)<\/Cd>/)
            const amtMatch = bal.match(/<Amt Ccy="([^"]*)">([\d.]+)<\/Amt>/)
            const cdMatch = bal.match(/<CdtDbtInd>([^<]+)<\/CdtDbtInd>/)

            if (typeMatch && amtMatch) {
                const amount = parseFloat(amtMatch[2])
                const signed = cdMatch?.[1] === 'DBIT' ? -amount : amount
                stmt.currency = amtMatch[1]

                if (typeMatch[1] === 'OPBD') stmt.openingBalance = signed
                else if (typeMatch[1] === 'CLBD') stmt.closingBalance = signed
            }
        }

        // Entries (transactions)
        const entryBlocks = stmtBlock.match(/<Ntry>([\s\S]*?)<\/Ntry>/g) || []
        for (const entry of entryBlocks) {
            const amtMatch = entry.match(/<Amt Ccy="([^"]*)">([\d.]+)<\/Amt>/)
            const cdMatch = entry.match(/<CdtDbtInd>([^<]+)<\/CdtDbtInd>/)
            const dateMatch = entry.match(/<BookgDt><Dt>([^<]+)<\/Dt><\/BookgDt>/) ||
                entry.match(/<ValDt><Dt>([^<]+)<\/Dt><\/ValDt>/)
            const refMatch = entry.match(/<EndToEndId>([^<]+)<\/EndToEndId>/)
            const ustrdMatch = entry.match(/<Ustrd>([^<]+)<\/Ustrd>/)
            const acctRefMatch = entry.match(/<AcctSvcrRef>([^<]+)<\/AcctSvcrRef>/)

            if (amtMatch) {
                const amount = parseFloat(amtMatch[2])
                const isCredit = cdMatch?.[1] !== 'DBIT'

                const description = ustrdMatch?.[1] || ''
                const bankReference = acctRefMatch?.[1] || ''
                const reference = extractReference(
                    description,
                    refMatch?.[1] || bankReference
                )

                stmt.transactions.push({
                    date: dateMatch?.[1] || '',
                    valueDate: dateMatch?.[1] || '',
                    amount: isCredit ? amount : -amount,
                    currency: amtMatch[1],
                    reference,
                    description,
                    bankReference,
                    type: isCredit ? 'credit' : 'debit',
                })
            }
        }

        if (stmt.transactions.length > 0 || stmt.accountId) {
            statements.push(stmt)
        }
    }

    return statements
}

/**
 * Auto-detect format and parse.
 */
export function parseBankStatement(content: string): MT940Statement[] {
    const trimmed = content.trim()
    if (trimmed.startsWith('<?xml') || trimmed.startsWith('<Document')) {
        return parseCAMT053(trimmed)
    }
    return parseMT940(trimmed)
}

// --- Helpers ---

function parseAmount(str: string): number {
    // MT940 uses comma as decimal separator
    return parseFloat(str.replace(',', '.'))
}

function parseDate6(yymmdd: string): string {
    const yy = parseInt(yymmdd.substring(0, 2))
    const mm = yymmdd.substring(2, 4)
    const dd = yymmdd.substring(4, 6)
    const year = yy > 80 ? 1900 + yy : 2000 + yy
    return `${year}-${mm}-${dd}`
}

function extractReference(description: string, fallback: string): string {
    // Try to find order number patterns (e.g., ORD-2024-001, SI-2024-0001, #12345)
    const orderPatterns = [
        /(?:ORD|SI|DE|FR|IT|ES|EU|MK)-\d{4}-\d{3,}/i,
        /#?\d{5,}/,
        /(?:SVREF|KREF|EREF)[+:\/]?\s*(\S+)/i,
        /\/REF\/([^\s/]+)/i,
        /(?:reference|ref|sklicna)\s*:?\s*(\S+)/i,
    ]

    for (const pattern of orderPatterns) {
        const match = description.match(pattern)
        if (match) {
            return match[1] || match[0]
        }
    }

    // Check fallback (bank reference)
    if (fallback && fallback !== 'NONREF') {
        for (const pattern of orderPatterns) {
            const match = fallback.match(pattern)
            if (match) return match[1] || match[0]
        }
    }

    return fallback || description.substring(0, 50)
}
