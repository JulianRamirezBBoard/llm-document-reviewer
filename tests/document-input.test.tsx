import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentInput } from '@/components/DocumentInput/DocumentInput'
import { SAMPLE_DOCUMENT } from '@/lib/document/sampleDocument'

// The real editor pulls in Tiptap, which is heavy for jsdom. A plain textarea
// stand-in is enough for these tests and keeps the value controllable.
jest.mock('@/components/DocumentEditor/DocumentEditor', () => ({
  DocumentEditor: ({
    value,
    onChange,
    ariaLabel,
  }: {
    value: string
    onChange?: (next: string) => void
    ariaLabel?: string
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}))

const renderInput = (isBusy = false) => {
  const props = { onSubmitText: jest.fn(), onSubmitPdf: jest.fn() }
  const view = render(<DocumentInput {...props} isBusy={isBusy} />)
  return { ...view, ...props }
}

describe('DocumentInput', () => {
  it('runs the built-in sample through the normal submit path', async () => {
    const user = userEvent.setup()
    const { onSubmitText } = renderInput()

    await user.click(screen.getByRole('button', { name: /show me a sample/i }))

    expect(onSubmitText).toHaveBeenCalledWith(SAMPLE_DOCUMENT.trim())
    expect(screen.getByLabelText('Paste document text')).toHaveValue(
      SAMPLE_DOCUMENT,
    )
  })

  it('shows the spinner on the sample button while the sample runs', async () => {
    const user = userEvent.setup()
    const props = { onSubmitText: jest.fn(), onSubmitPdf: jest.fn() }
    const { rerender } = render(<DocumentInput {...props} isBusy={false} />)

    await user.click(screen.getByRole('button', { name: /show me a sample/i }))
    rerender(<DocumentInput {...props} isBusy={true} />)

    const sampleButton = screen.getByRole('button', {
      name: /show me a sample/i,
    })
    expect(sampleButton).toHaveAttribute('aria-busy', 'true')
    expect(sampleButton).toBeDisabled()

    // The main submit button stays quiet: no spinner, just disabled.
    const submitButton = screen.getByRole('button', {
      name: /read the document/i,
    })
    expect(submitButton).not.toHaveAttribute('aria-busy')
    expect(submitButton).toBeDisabled()
  })

  it('leads with the sample button and a hint while the editor is empty', () => {
    renderInput()

    expect(
      screen.getByText('New here? Try a sample first.'),
    ).toBeInTheDocument()

    const sampleButton = screen.getByRole('button', {
      name: /show me a sample/i,
    })
    const submitButton = screen.getByRole('button', {
      name: /read the document/i,
    })
    // "bg-stamp" is the loud primary fill. It sits on the sample button here.
    expect(sampleButton.className).toContain('bg-stamp')
    expect(submitButton.className).not.toContain('bg-stamp')
  })

  it('hands the primary style back to the submit button once text is pasted', async () => {
    const user = userEvent.setup()
    renderInput()

    await user.type(
      screen.getByLabelText('Paste document text'),
      'Vendor: Acme Corp',
    )

    expect(
      screen.queryByText('New here? Try a sample first.'),
    ).not.toBeInTheDocument()

    const sampleButton = screen.getByRole('button', {
      name: /show me a sample/i,
    })
    const submitButton = screen.getByRole('button', {
      name: /read the document/i,
    })
    expect(submitButton.className).toContain('bg-stamp')
    expect(sampleButton.className).not.toContain('bg-stamp')
  })
})
