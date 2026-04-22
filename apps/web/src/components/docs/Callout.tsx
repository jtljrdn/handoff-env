import { Info, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'

type CalloutType = 'info' | 'warn' | 'success' | 'danger'

const STYLES: Record<
  CalloutType,
  { icon: typeof Info; border: string; bg: string; iconColor: string }
> = {
  info: {
    icon: Info,
    border: 'border-[var(--h-accent)]/30',
    bg: 'bg-[var(--h-accent-subtle)]/40',
    iconColor: 'text-[var(--h-accent)]',
  },
  warn: {
    icon: AlertTriangle,
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    iconColor: 'text-amber-600 dark:text-amber-500',
  },
  success: {
    icon: CheckCircle2,
    border: 'border-[var(--h-success)]/30',
    bg: 'bg-[var(--h-success)]/5',
    iconColor: 'text-[var(--h-success)]',
  },
  danger: {
    icon: XCircle,
    border: 'border-red-500/30',
    bg: 'bg-red-500/5',
    iconColor: 'text-red-600 dark:text-red-500',
  },
}

export function Callout({
  type = 'info',
  children,
}: {
  type?: CalloutType
  children: ReactNode
}) {
  const style = STYLES[type]
  const Icon = style.icon
  return (
    <aside
      className={`not-prose my-6 flex gap-3 overflow-hidden rounded-xl border ${style.border} ${style.bg} px-4 py-3.5`}
    >
      <Icon className={`mt-0.5 size-4 shrink-0 ${style.iconColor}`} />
      <div
        className={[
          // min-w-0 lets this flex child shrink below its content's intrinsic
          // width so long <pre> blocks don't push the callout wider than its
          // container. flex-1 claims the remaining horizontal space.
          'min-w-0 flex-1 text-sm leading-relaxed text-[var(--h-text-2)]',
          '[&>p]:m-0 [&>p+p]:mt-2',
          // Code blocks scroll horizontally instead of overflowing the aside.
          '[&_pre]:overflow-x-auto [&_pre]:max-w-full',
          // Inline code wraps rather than extending its line.
          '[&_code]:break-words',
        ].join(' ')}
      >
        {children}
      </div>
    </aside>
  )
}
