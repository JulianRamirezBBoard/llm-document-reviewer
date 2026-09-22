import type { ComponentPropsWithRef } from 'react'

export const BUTTON_VARIANTS = ['primary', 'outline', 'outlineAlert'] as const
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number]

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant: ButtonVariant
  // When true the button shows a spinner, reads as busy, and cannot be pressed.
  isLoading?: boolean
}

const baseButtonClasses =
  'inline-flex items-center justify-center gap-2 cursor-pointer rounded-[2px] font-data text-xs tracking-[0.08em] uppercase transition-colors disabled:cursor-not-allowed'

// Each variant carries its own size and color together: "primary" is the
// prominent call to action, the other two are smaller secondary actions.
// Each darkens on hover and darkens again on press (active).
const variantButtonClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-stamp px-5 py-3 font-medium text-paper-raised active:translate-y-px enabled:hover:bg-stamp-deep enabled:active:bg-stamp-deep enabled:active:brightness-90 disabled:bg-paper-line disabled:text-ink-soft',
  outline:
    'border border-ink-soft px-4 py-3 text-ink-soft enabled:hover:border-ink enabled:hover:text-ink enabled:active:bg-paper-line enabled:active:text-ink',
  outlineAlert:
    'border border-alert px-3 py-2.5 text-alert enabled:hover:bg-alert enabled:hover:text-paper-raised enabled:active:bg-alert-deep enabled:active:text-paper-raised',
}

// Exported so a non-<button> element that must stay its own tag for
// accessibility (a <label> tied to a hidden file input) can still reuse the
// exact same visual recipe instead of retyping it.
export const getButtonClassNames = (variant: ButtonVariant, className = '') =>
  [baseButtonClasses, variantButtonClasses[variant], className]
    .filter(Boolean)
    .join(' ')

export function Button({
  variant,
  className,
  isLoading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={getButtonClassNames(variant, className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading && (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  )
}
