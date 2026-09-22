import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { ExtractedFieldsTable } from '@/components/ExtractedFieldsTable/ExtractedFieldsTable'
import type { DocumentField } from '@/lib/document/types'

interface ControlledTableProps {
  initialFields: DocumentField[]
  onFieldChange?: (id: string, value: string) => void
}

// Mirrors the real workflow: an edit only changes the value and forces the
// field back to a draft; a Confirm click is the one path to human-confirmed.
const ControlledTable = ({
  initialFields,
  onFieldChange,
}: ControlledTableProps) => {
  const [fields, setFields] = useState(initialFields)
  const handleFieldChange = (id: string, value: string) => {
    onFieldChange?.(id, value)
    setFields((current) =>
      current.map((field) =>
        field.id === id ? { ...field, value, source: 'ai' } : field,
      ),
    )
  }
  const handleConfirmField = (id: string) => {
    setFields((current) =>
      current.map((field) =>
        field.id === id ? { ...field, source: 'human' } : field,
      ),
    )
  }
  return (
    <ExtractedFieldsTable
      fields={fields}
      onFieldChange={handleFieldChange}
      onConfirmField={handleConfirmField}
    />
  )
}

const buildField = (overrides: Partial<DocumentField> = {}): DocumentField => ({
  id: 'field-1',
  label: 'Total',
  value: '$100.00',
  source: 'ai',
  ...overrides,
})

describe('ExtractedFieldsTable', () => {
  it('renders nothing when there are no fields', () => {
    const { container } = render(
      <ExtractedFieldsTable fields={[]} onFieldChange={jest.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows an untouched field as a draft', () => {
    render(
      <ExtractedFieldsTable
        fields={[buildField()]}
        onFieldChange={jest.fn()}
      />,
    )
    expect(screen.getByText('Draft', { exact: false })).toBeInTheDocument()
  })

  it('calls onFieldChange with the new value when the user edits a field', async () => {
    const user = userEvent.setup()
    const onFieldChange = jest.fn()
    render(
      <ControlledTable
        initialFields={[buildField()]}
        onFieldChange={onFieldChange}
      />,
    )

    const input = screen.getByLabelText('Total')
    await user.clear(input)
    await user.type(input, '$200.00')

    expect(onFieldChange).toHaveBeenLastCalledWith('field-1', '$200.00')
  })

  it('shows a field as confirmed once its source is human', () => {
    render(
      <ExtractedFieldsTable
        fields={[buildField({ source: 'human', value: '$200.00' })]}
        onFieldChange={jest.fn()}
      />,
    )
    expect(screen.getByText('Confirmed', { exact: false })).toBeInTheDocument()
  })

  it('does not confirm a field when the user only edits it', async () => {
    const user = userEvent.setup()
    render(<ControlledTable initialFields={[buildField()]} />)

    await user.type(screen.getByLabelText('Total'), '0')

    expect(screen.getByText('Draft', { exact: false })).toBeInTheDocument()
    expect(
      screen.queryByText('Confirmed', { exact: false }),
    ).not.toBeInTheDocument()
  })

  it('confirms a field and announces it when its Confirm button is clicked', async () => {
    const user = userEvent.setup()
    render(<ControlledTable initialFields={[buildField()]} />)

    await user.click(screen.getByRole('button', { name: /confirm total/i }))

    // Exact match, so the "Total confirmed" status line is not also picked up.
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Total confirmed')
  })

  it('drops a confirmed field back to draft when its value is edited', async () => {
    const user = userEvent.setup()
    render(<ControlledTable initialFields={[buildField()]} />)

    await user.click(screen.getByRole('button', { name: /confirm total/i }))
    expect(screen.getByText('Confirmed')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Total'), '5')

    expect(screen.getByText('Draft', { exact: false })).toBeInTheDocument()
    expect(screen.queryByText('Confirmed')).not.toBeInTheDocument()
  })
})
