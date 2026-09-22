// Turns pasted plain text into the HTML the editor loads: blank lines become
// paragraph breaks, single line breaks become <br>. This keeps
// editor.getText({ blockSeparator: '\n\n' }) round-tripping back to the same
// plain text the extractor was given.

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const plainTextToHtml = (text: string): string => {
  if (text.trim().length === 0) {
    return '<p></p>'
  }
  return text
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n').map(escapeHtml).join('<br>')
      return `<p>${lines}</p>`
    })
    .join('')
}
