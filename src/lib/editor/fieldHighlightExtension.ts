import { Decoration, Extension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { FieldSource } from '@/lib/document/types'

export interface HighlightField {
  id: string
  value: string
  source: FieldSource
}

interface FieldHighlightStorage {
  fields: HighlightField[]
  activeId: string | null
}

declare module '@tiptap/core' {
  interface Storage {
    fieldHighlight: FieldHighlightStorage
  }

  interface Commands<ReturnType> {
    fieldHighlight: {
      setHighlightFields: (fields: HighlightField[]) => ReturnType
      setActiveHighlight: (id: string | null) => ReturnType
    }
  }
}

// Walks the document once, building a plain-text copy of it plus a lookup
// from each plain-text character index to its ProseMirror position. Block
// separators are left out on purpose: field values are always single-line,
// so a separator-free copy still finds every match, and the position lookup
// stays exact.
const buildPositionMap = (doc: ProseMirrorNode) => {
  let plain = ''
  const positions: number[] = []
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let index = 0; index < node.text.length; index += 1) {
        plain += node.text[index]
        positions.push(pos + index)
      }
      return
    }
    if (node.type.name === 'hardBreak') {
      plain += '\n'
      positions.push(pos)
    }
  })
  return { plain, positions }
}

export const FieldHighlight = Extension.create<
  Record<string, never>,
  FieldHighlightStorage
>({
  name: 'fieldHighlight',

  addStorage() {
    return { fields: [], activeId: null }
  },

  addCommands() {
    return {
      setHighlightFields:
        (fields: HighlightField[]) =>
        ({ editor, commands }) => {
          editor.storage.fieldHighlight.fields = fields
          commands.updateDecorations('fieldHighlight')
          return true
        },
      setActiveHighlight:
        (id: string | null) =>
        ({ editor, commands }) => {
          editor.storage.fieldHighlight.activeId = id
          commands.updateDecorations('fieldHighlight')
          return true
        },
    }
  },

  addDecorations() {
    return {
      update: 'manual',
      create: ({ editor, state }) => {
        const { fields, activeId } = editor.storage.fieldHighlight
        if (fields.length === 0) {
          return []
        }
        const { plain, positions } = buildPositionMap(state.doc)
        const haystack = plain.toLowerCase()
        const decorations: Decoration[] = []
        for (const field of fields) {
          const needle = field.value.trim().toLowerCase()
          if (needle.length === 0) {
            continue
          }
          const start = haystack.indexOf(needle)
          if (start === -1) {
            continue
          }
          const end = start + needle.length - 1
          const from = positions[start]
          const to = positions[end] + 1
          const isActive = field.id === activeId
          decorations.push(
            Decoration.Inline(from, to, {
              class: [
                'field-highlight',
                `field-highlight--${field.source}`,
                isActive ? 'field-highlight--active' : '',
              ]
                .filter(Boolean)
                .join(' '),
            }),
          )
        }
        return decorations
      },
    }
  },
})
