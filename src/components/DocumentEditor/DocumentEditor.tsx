'use client'

import { useEffect, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  FieldHighlight,
  type HighlightField,
} from '@/lib/editor/fieldHighlightExtension'
import { plainTextToHtml } from '@/lib/editor/plainTextHtml'

interface DocumentEditorProps {
  value: string
  onChange: (text: string) => void
  ariaLabel: string
  editable?: boolean
  disabled?: boolean
  highlightFields?: HighlightField[]
  activeFieldId?: string | null
  // Bump this to force the highlights to re-match against the current text,
  // used when the user chooses to update stale highlights after an edit.
  highlightRebuildToken?: number
}

const PLAIN_TEXT_OPTIONS = { blockSeparator: '\n\n' } as const

// Only paragraphs, line breaks, and undo/redo. The extractor reads plain
// text, so bold/headings/lists would be controls that change nothing.
const starterKit = StarterKit.configure({
  bold: false,
  italic: false,
  strike: false,
  code: false,
  heading: false,
  blockquote: false,
  codeBlock: false,
  bulletList: false,
  orderedList: false,
  listItem: false,
  horizontalRule: false,
})

export function DocumentEditor({
  value,
  onChange,
  ariaLabel,
  editable = true,
  disabled = false,
  highlightFields = [],
  activeFieldId = null,
  highlightRebuildToken = 0,
}: DocumentEditorProps) {
  const lastEmittedRef = useRef(value)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  })

  const editor = useEditor({
    immediatelyRender: false,
    editable: editable && !disabled,
    extensions: [starterKit, FieldHighlight],
    content: plainTextToHtml(value),
    editorProps: {
      attributes: {
        'aria-label': ariaLabel,
        role: 'textbox',
        'aria-multiline': 'true',
        class: 'document-editor-surface',
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText(PLAIN_TEXT_OPTIONS)
      lastEmittedRef.current = text
      onChangeRef.current(text)
    },
  })

  // Push an external value change into the editor, but skip the echo of an
  // edit that started in the editor itself.
  useEffect(() => {
    if (!editor) {
      return
    }
    if (value === lastEmittedRef.current) {
      return
    }
    if (value === editor.getText(PLAIN_TEXT_OPTIONS)) {
      return
    }
    lastEmittedRef.current = value
    editor.commands.setContent(plainTextToHtml(value), {
      emitUpdate: false,
      parseOptions: { preserveWhitespace: 'full' },
    })
  }, [editor, value])

  useEffect(() => {
    if (!editor) {
      return
    }
    editor.commands.setHighlightFields(highlightFields)
  }, [editor, highlightFields, highlightRebuildToken])

  useEffect(() => {
    if (!editor) {
      return
    }
    editor.commands.setActiveHighlight(activeFieldId)
  }, [editor, activeFieldId])

  useEffect(() => {
    if (!editor) {
      return
    }
    editor.setEditable(editable && !disabled)
  }, [editor, editable, disabled])

  if (!editor) {
    return null
  }

  return <EditorContent editor={editor} />
}
