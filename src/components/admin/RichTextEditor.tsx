'use client'

import React, { useEffect, useRef, useState } from 'react'

interface RichTextEditorProps {
    value: string
    onChange: (value: string) => void
    label?: string
    placeholder?: string
}

export default function RichTextEditor({ value, onChange, label, placeholder }: RichTextEditorProps) {
    const [mode, setMode] = useState<'visual' | 'html'>('visual')
    const [html, setHtml] = useState(value || '')
    const visualRef = useRef<HTMLDivElement>(null)

    // Sync external value changes (only if not focused or significantly different to avoid cursor jumps)
    // For simplicity, we sync on mount or if value changes significantly from outside, but mostly we rely on internal state
    useEffect(() => {
        if (value !== html) {
            // Only update if the incoming value is different from our local state
            // This prevents loops, but might miss external resets.
            // Ideally we compare content.
            // For now, let's just sync if local is empty.
            if (!html && value) setHtml(value)
        }
    }, [value])

    // Update Visual Div when switching to Visual Mode
    useEffect(() => {
        if (mode === 'visual' && visualRef.current) {
            visualRef.current.innerHTML = html
        }
    }, [mode, html])

    const handleVisualChange = () => {
        if (visualRef.current) {
            const newHtml = visualRef.current.innerHTML
            setHtml(newHtml)
            onChange(newHtml)
        }
    }

    const handleHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setHtml(e.target.value)
        onChange(e.target.value)
    }

    const execCmd = (cmd: string, val?: string) => {
        document.execCommand(cmd, false, val)
        handleVisualChange() // Sync immediately
        visualRef.current?.focus()
    }

    return (
        <div className="w-full">
            {label && <label className="block text-sm font-semibold mb-1">{label}</label>}

            {/* Toolbar */}
            <div className="flex items-center justify-between border border-b-0 rounded-t-lg bg-gray-50 p-2">
                <div className="flex gap-1">
                    {mode === 'visual' && (
                        <>
                            <ToolbarButton onClick={() => execCmd('bold')} label="B" title="Bold" className="font-bold" />
                            <ToolbarButton onClick={() => execCmd('italic')} label="I" title="Italic" className="italic" />
                            <ToolbarButton onClick={() => execCmd('underline')} label="U" title="Underline" className="underline" />
                            <div className="w-px h-6 bg-gray-300 mx-1"></div>
                            <ToolbarButton onClick={() => execCmd('insertUnorderedList')} label="• List" title="Bullet List" />
                            <ToolbarButton onClick={() => execCmd('insertOrderedList')} label="1. List" title="Numbered List" />
                            <div className="w-px h-6 bg-gray-300 mx-1"></div>
                            {/* Basic Headers */}
                            <ToolbarButton onClick={() => execCmd('formatBlock', 'H3')} label="H3" title="Header 3" />
                            <ToolbarButton onClick={() => execCmd('formatBlock', 'P')} label="P" title="Paragraph" />
                            {/* Clear Format */}
                            <ToolbarButton onClick={() => execCmd('removeFormat')} label="Clear" title="Remove Formatting" className="text-red-500" />
                        </>
                    )}
                </div>
                <div>
                    <button
                        type="button"
                        onClick={() => setMode(mode === 'visual' ? 'html' : 'visual')}
                        className={`text-xs px-2 py-1 rounded border ${mode === 'html' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                    >
                        {mode === 'visual' ? '</> HTML' : 'Visual'}
                    </button>
                </div>
            </div>

            {/* Editor Area */}
            <div className={`border rounded-b-lg overflow-hidden min-h-[300px] bg-white ${mode === 'visual' ? 'cursor-text' : ''}`}>
                {mode === 'visual' ? (
                    <div
                        ref={visualRef}
                        contentEditable
                        onInput={handleVisualChange}
                        onBlur={handleVisualChange}
                        className="w-full h-full min-h-[300px] p-4 outline-none prose prose-blue max-w-none"
                    />
                ) : (
                    <textarea
                        value={html}
                        onChange={handleHtmlChange}
                        className="w-full h-full min-h-[300px] p-4 font-mono text-sm outline-none resize-none"
                        placeholder="Enter HTML here..."
                    />
                )}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
                {mode === 'visual' ? 'Tip: Select text to apply formatting.' : 'Editing raw HTML. Be careful with tags.'}
            </p>
        </div>
    )
}

function ToolbarButton({ onClick, label, title, className = '' }: { onClick: () => void, label: string, title: string, className?: string }) {
    return (
        <button
            type="button"
            onClick={(e) => { e.preventDefault(); onClick(); }}
            title={title}
            className={`px-2 py-1 min-w-[32px] text-sm rounded hover:bg-gray-200 text-gray-700 transition ${className}`}
        >
            {label}
        </button>
    )
}
