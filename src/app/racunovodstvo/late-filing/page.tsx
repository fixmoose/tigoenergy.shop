import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'

const MONTHS_SI = ['Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij', 'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December']

interface PageProps {
    searchParams: Promise<{ token?: string; choice?: 'keep' | 'move' }>
}

export default async function LateFilingPage({ searchParams }: PageProps) {
    const params = await searchParams
    const token = params.token || ''
    const choice = params.choice

    if (!token || !choice || (choice !== 'keep' && choice !== 'move')) {
        return renderShell({
            title: 'Neveljavna povezava',
            body: <p className="text-slate-600">Manjka token ali izbira. Prosim, uporabi povezavo iz e-poštnega sporočila.</p>,
        })
    }

    const supabase = await createAdminClient()

    const { data: expense, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('period_review_token', token)
        .maybeSingle()

    if (error) {
        return renderShell({
            title: 'Napaka',
            body: <p className="text-red-600">{error.message}</p>,
        })
    }
    if (!expense) {
        return renderShell({
            title: 'Povezava že porabljena',
            body: <p className="text-slate-600">Izbira je bila že potrjena ali pa povezava ni veljavna.</p>,
        })
    }
    if (expense.period_review_decided_at) {
        return renderShell({
            title: 'Že potrjeno',
            body: <p className="text-slate-600">Ta vnos je že bil potrjen {new Date(expense.period_review_decided_at).toLocaleString('sl-SI')}.</p>,
        })
    }

    const originalDate = expense.date as string
    const origDt = new Date(originalDate)
    const origLabel = `${MONTHS_SI[origDt.getMonth()]} ${origDt.getFullYear()}`
    const today = new Date()
    const todayIso = today.toISOString().split('T')[0]
    const todayLabel = `${MONTHS_SI[today.getMonth()]} ${today.getFullYear()}`

    const update: any = {
        period_review_decided_at: new Date().toISOString(),
        period_review_token: null,
    }
    if (choice === 'keep') {
        update.period_review_action = 'kept'
    } else {
        update.period_review_action = 'moved'
        update.period_review_original_date = originalDate
        update.date = todayIso
    }

    const { error: updErr } = await supabase
        .from('expenses')
        .update(update)
        .eq('id', expense.id)

    if (updErr) {
        return renderShell({
            title: 'Napaka pri shranjevanju',
            body: <p className="text-red-600">{updErr.message}</p>,
        })
    }

    const decisionLabel = choice === 'keep'
        ? `Vnos je ostal v mesecu ${origLabel}.`
        : `Vnos je bil premaknjen iz ${origLabel} v ${todayLabel}.`

    return renderShell({
        title: 'Hvala — izbira je shranjena',
        body: (
            <div className="space-y-3">
                <p className="text-emerald-700 font-medium">{decisionLabel}</p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-1">
                    <div><span className="text-slate-500">Št. računa:</span> <span className="font-mono">{expense.invoice_number || '-'}</span></div>
                    <div><span className="text-slate-500">Dobavitelj:</span> {expense.supplier || '-'}</div>
                    <div><span className="text-slate-500">Opis:</span> {expense.description}</div>
                    <div><span className="text-slate-500">Znesek:</span> €{Number(expense.amount_eur).toFixed(2)}</div>
                </div>
                <Link href="/racunovodstvo" className="inline-block mt-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold text-sm">Odpri računovodstvo</Link>
            </div>
        ),
    })
}

function renderShell({ title, body }: { title: string; body: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-8">
                <h1 className="text-xl font-bold text-slate-800 mb-4">{title}</h1>
                {body}
                <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400">
                    Initra Energija d.o.o.
                </div>
            </div>
        </div>
    )
}
