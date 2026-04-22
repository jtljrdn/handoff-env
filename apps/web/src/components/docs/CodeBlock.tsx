import { useRef, useState, type HTMLAttributes } from 'react'
import { Check, Copy } from 'lucide-react'

/**
 * Wraps MDX-emitted `<pre>` blocks (styled by Shiki) and adds a copy-to-clipboard
 * button. The `<pre>` itself keeps Shiki's classes and inline styles, so syntax
 * highlighting is untouched.
 */
export function CodeBlock({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLPreElement>) {
  const ref = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    const text = ref.current?.innerText ?? ''
    if (!text || typeof navigator === 'undefined' || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API may fail in insecure contexts; no-op rather than surface a toast.
    }
  }

  return (
    <div className="group relative">
      <pre ref={ref} {...rest} className={className}>
        {children}
      </pre>
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
        className={[
          'absolute right-2 top-2',
          'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
          'border-[var(--h-border)] bg-[var(--h-surface)] text-[var(--h-text-2)]',
          'opacity-0 transition-opacity duration-150',
          'group-hover:opacity-100 focus-visible:opacity-100',
          'hover:border-[var(--h-accent)] hover:text-[var(--h-text)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-accent)]',
          // On touch devices, hover never fires, so keep the button visible.
          '[@media(hover:none)]:opacity-70',
        ].join(' ')}
      >
        {copied ? (
          <>
            <Check className="size-3" aria-hidden />
            Copied
          </>
        ) : (
          <>
            <Copy className="size-3" aria-hidden />
            Copy
          </>
        )}
      </button>
    </div>
  )
}
