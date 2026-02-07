'use client'

import { useState } from 'react'
import type { PricingSchema, CustomerPricingSchema } from '@/types/database'
import { assignSchemaToCustomer, unassignSchemaFromCustomer } from '@/app/actions/pricing'

interface CustomerPricingAssignmentProps {
    customerId: string
    allSchemas: PricingSchema[]
    currentSchemas: (CustomerPricingSchema & { schema: PricingSchema })[]
}

export default function CustomerPricingAssignment({ customerId, allSchemas, currentSchemas: initialSchemas }: CustomerPricingAssignmentProps) {
    const [currentSchemas, setCurrentSchemas] = useState(initialSchemas)
    const [selectedSchemaId, setSelectedSchemaId] = useState('')
    const [priority, setPriority] = useState(0)
    const [loading, setLoading] = useState(false)

    const handleAssign = async () => {
        if (!selectedSchemaId) return
        setLoading(true)
        try {
            await assignSchemaToCustomer(customerId, selectedSchemaId, priority)
            // Optimistic update or just let revalidatePath handle it (revalidatePath will refresh the server component)
            window.location.reload()
        } catch (error) {
            alert((error as Error).message)
        } finally {
            setLoading(false)
        }
    }

    const handleUnassign = async (schemaId: string) => {
        if (!confirm('Remove this schema from customer?')) return
        try {
            await unassignSchemaFromCustomer(customerId, schemaId)
            window.location.reload()
        } catch (error) {
            alert((error as Error).message)
        }
    }

    const availableSchemas = allSchemas.filter(s => !currentSchemas.find(cs => cs.schema_id === s.id))

    return (
        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <div>
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Pricing Schemas</h3>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">Applied Discounts & Fixed Prices</p>
                </div>
            </div>

            <div className="p-8 space-y-6">
                {/* Current Schemas */}
                <div className="space-y-3">
                    {currentSchemas.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No custom pricing schemas applied to this customer.</p>
                    ) : (
                        currentSchemas.map(cs => (
                            <div key={cs.schema_id} className="flex items-center justify-between p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                                <div>
                                    <div className="font-bold text-blue-900">{cs.schema.name}</div>
                                    <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-0.5">Priority: {cs.priority}</div>
                                </div>
                                <button
                                    onClick={() => handleUnassign(cs.schema_id)}
                                    className="text-blue-300 hover:text-red-500 transition-colors font-bold text-xl"
                                >
                                    &times;
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Assign New Schema */}
                <div className="pt-6 border-t border-gray-50">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Assign New Schema</h4>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <select
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                            value={selectedSchemaId}
                            onChange={e => setSelectedSchemaId(e.target.value)}
                        >
                            <option value="">Select a schema...</option>
                            {availableSchemas.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Priority</span>
                            <input
                                type="number"
                                className="w-20 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 text-center"
                                value={priority}
                                onChange={e => setPriority(Number(e.target.value))}
                            />
                        </div>
                        <button
                            onClick={handleAssign}
                            disabled={loading || !selectedSchemaId}
                            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
                        >
                            Assign
                        </button>
                    </div>
                </div>
            </div>
        </section>
    )
}
