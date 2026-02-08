'use client'
import React, { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Underline } from '@tiptap/extension-underline'
import { Link } from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { TextAlign } from '@tiptap/extension-text-align'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { FontFamily } from '@tiptap/extension-font-family'
import { Highlight } from '@tiptap/extension-highlight'
import { Image } from '@tiptap/extension-image'
import { Placeholder } from '@tiptap/extension-placeholder'
import { BubbleMenu as BubbleMenuExtension } from '@tiptap/extension-bubble-menu'

interface TemplateEditorProps {
    content: string
    onChange: (html: string) => void
    placeholder?: string
}

const MenuBar = ({ editor, viewMode, setViewMode }: { editor: any, viewMode: 'visual' | 'html', setViewMode: (v: 'visual' | 'html') => void }) => {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [tableConfig, setTableConfig] = useState({ rows: 3, cols: 3, show: false })

    if (!editor) return null

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = (event) => {
                const src = event.target?.result as string
                editor.chain().focus().setImage({ src }).run()
            }
            reader.readAsDataURL(file)
        }
    }

    const insertTable = () => {
        editor.chain().focus().insertTable({
            rows: tableConfig.rows,
            cols: tableConfig.cols,
            withHeaderRow: true
        }).run()
        setTableConfig({ ...tableConfig, show: false })
    }

    return (
        <div className="border-b border-gray-200 p-2 flex flex-wrap gap-1 bg-gray-50/50 sticky top-0 z-10 items-center">

            {/* View Toggle */}
            <div className="flex bg-gray-200 rounded-md p-0.5 mr-2">
                <button
                    onClick={() => setViewMode('visual')}
                    className={`px-3 py-1 text-[10px] font-bold rounded ${viewMode === 'visual' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    VISUAL
                </button>
                <button
                    onClick={() => setViewMode('html')}
                    className={`px-3 py-1 text-[10px] font-bold rounded ${viewMode === 'html' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    HTML
                </button>
            </div>

            {viewMode === 'visual' && (
                <>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                    />

                    <button
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('bold') ? 'bg-gray-200' : ''}`}
                        title="Bold"
                    >
                        <strong>B</strong>
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('italic') ? 'bg-gray-200' : ''}`}
                        title="Italic"
                    >
                        <em>I</em>
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('underline') ? 'bg-gray-200' : ''}`}
                        title="Underline"
                    >
                        <u>U</u>
                    </button>

                    <div className="w-px h-6 bg-gray-200 mx-1 self-center" />

                    <div className="relative inline-block">
                        <button
                            onClick={() => setTableConfig({ ...tableConfig, show: !tableConfig.show })}
                            className={`p-1.5 rounded hover:bg-gray-200 flex items-center gap-1 ${tableConfig.show ? 'bg-gray-200' : ''}`}
                            title="Insert Table"
                        >
                            <span className="text-xs font-bold">TBL</span>
                            <span className="text-[8px]">▼</span>
                        </button>
                        {tableConfig.show && (
                            <div className="absolute top-full left-0 mt-1 bg-white border rounded shadow-xl p-3 z-50 w-48 animate-in fade-in slide-in-from-top-1">
                                <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Table Size</div>
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    <div>
                                        <label className="text-[9px] block mb-1">Rows</label>
                                        <input
                                            type="number"
                                            value={tableConfig.rows}
                                            onChange={e => setTableConfig({ ...tableConfig, rows: parseInt(e.target.value) || 1 })}
                                            className="w-full border rounded px-1 py-0.5 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] block mb-1">Cols</label>
                                        <input
                                            type="number"
                                            value={tableConfig.cols}
                                            onChange={e => setTableConfig({ ...tableConfig, cols: parseInt(e.target.value) || 1 })}
                                            className="w-full border rounded px-1 py-0.5 text-xs"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={insertTable}
                                    className="w-full bg-blue-600 text-white text-xs py-1.5 rounded font-bold hover:bg-blue-700"
                                >
                                    Insert Table
                                </button>
                            </div>
                        )}
                    </div>

                    {editor.isActive('table') && (
                        <div className="flex gap-1 bg-blue-50/50 p-0.5 rounded border border-blue-100 mx-1">
                            <button onClick={() => editor.chain().focus().addColumnBefore().run()} className="px-1.5 text-[10px] hover:bg-white rounded border" title="Add Col Before">+</button>
                            <button onClick={() => editor.chain().focus().addRowBefore().run()} className="px-1.5 text-[10px] hover:bg-white rounded border" title="Add Row Before">+R</button>
                            <button onClick={() => editor.chain().focus().deleteTable().run()} className="px-1.5 text-[10px] text-red-600 hover:bg-red-50 rounded border" title="Delete Table">DEL</button>
                        </div>
                    )}

                    <div className="w-px h-6 bg-gray-200 mx-1 self-center" />

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 rounded hover:bg-gray-200"
                        title="Upload Photo"
                    >
                        📷
                    </button>
                </>
            )}

            <button
                onClick={() => editor.chain().focus().undo().run()}
                className="p-1.5 rounded hover:bg-gray-200 ml-auto"
            >
                ⟲
            </button>
            <button
                onClick={() => editor.chain().focus().redo().run()}
                className="p-1.5 rounded hover:bg-gray-200"
            >
                ⟳
            </button>
        </div>
    )
}

export default function TemplateEditor({ content, onChange, placeholder }: TemplateEditorProps) {
    const [viewMode, setViewMode] = useState<'visual' | 'html'>('visual')

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Link.configure({ openOnClick: false }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            TextStyle,
            Color,
            FontFamily,
            Highlight,
            Image.configure({
                allowBase64: true,
                HTMLAttributes: {
                    class: 'editor-image',
                },
            }),
            Table.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
            Placeholder.configure({ placeholder: placeholder || 'Start writing your template...' }),
            BubbleMenuExtension,
        ],
        content: content,
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML())
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none min-h-[400px] p-6 max-w-none',
            },
            handleDrop: (view, event, slice, moved) => {
                if (!moved && event.dataTransfer && event.dataTransfer.getData('text/plain')) {
                    const text = event.dataTransfer.getData('text/plain')
                    if (text.startsWith('{') && text.endsWith('}')) {
                        const { schema } = view.state
                        const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY })
                        if (coordinates) {
                            const transaction = view.state.tr.insertText(text, coordinates.pos)
                            view.dispatch(transaction)
                            return true
                        }
                    }
                }
                return false
            },
        },
    })

    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content)
        }
    }, [content, editor])

    return (
        <div className="border border-gray-200 rounded-lg bg-white shadow-inner flex flex-col min-h-[500px]">
            <MenuBar editor={editor} viewMode={viewMode} setViewMode={setViewMode} />

            {viewMode === 'visual' && editor && editor.isActive('image') && (
                <div className="flex gap-2 bg-blue-50 border-y shadow-inner p-2 items-center justify-center">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tight">Image Width:</span>
                    <button onClick={() => editor.commands.updateAttributes('image', { width: '25%' })} className="px-3 py-1 text-xs bg-white hover:bg-gray-100 rounded border font-medium">25%</button>
                    <button onClick={() => editor.commands.updateAttributes('image', { width: '50%' })} className="px-3 py-1 text-xs bg-white hover:bg-gray-100 rounded border font-medium">50%</button>
                    <button onClick={() => editor.commands.updateAttributes('image', { width: '100%' })} className="px-3 py-1 text-xs bg-white hover:bg-gray-100 rounded border font-medium">100%</button>
                    <div className="w-px h-4 bg-blue-200 mx-2" />
                    <button onClick={() => editor.chain().focus().deleteSelection().run()} className="px-3 py-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded border border-red-200 font-medium">Delete Image</button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto flex flex-col">
                {viewMode === 'visual' ? (
                    <EditorContent editor={editor} />
                ) : (
                    <textarea
                        className="flex-1 w-full p-6 font-mono text-sm bg-gray-50 outline-none resize-none min-h-[400px]"
                        value={content}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="Paste your HTML here..."
                    />
                )}
            </div>
            <style jsx global>{`
                .ProseMirror table {
                    border-collapse: collapse;
                    table-layout: fixed;
                    width: 100%;
                    margin: 0;
                    overflow: hidden;
                }
                .ProseMirror td, .ProseMirror th {
                    min-width: 1em;
                    border: 2px solid #ced4da;
                    padding: 3px 5px;
                    vertical-align: top;
                    box-sizing: border-box;
                    position: relative;
                }
                .ProseMirror th {
                    font-weight: bold;
                    text-align: left;
                    background-color: #f1f3f5;
                }
                .ProseMirror .selectedCell:after {
                    z-index: 2;
                    content: "";
                    position: absolute;
                    left: 0; right: 0; top: 0; bottom: 0;
                    background: rgba(200, 200, 255, 0.4);
                    pointer-events: none;
                }
                .ProseMirror .column-resize-handle {
                    position: absolute;
                    right: -2px;
                    top: 0;
                    bottom: -2px;
                    width: 4px;
                    background-color: #adf;
                    pointer-events: none;
                }
                .ProseMirror p.is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    float: left;
                    color: #adb5bd;
                    pointer-events: none;
                    height: 0;
                }
                .editor-image {
                    display: block;
                    margin-left: auto;
                    margin-right: auto;
                    transition: all 0.2s;
                    cursor: pointer;
                }
                .editor-image:hover {
                    outline: 3px solid #3b82f6;
                }
            `}</style>
        </div>
    )
}
