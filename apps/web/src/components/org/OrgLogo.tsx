export function OrgLogo({
    logo,
    name,
    size,
  }: {
    logo: string | null
    name: string
    size: 'sm' | 'md' | 'lg'
  }) {
    const dim =
      size === 'lg' ? 'size-16 text-2xl' : size === 'md' ? 'size-10 text-sm' : 'size-7 text-xs'
    const initial = name.charAt(0).toUpperCase() || '?'
    const rounded = size === 'sm' ? 'rounded-md' : 'rounded-xl'
    if (logo) {
      return (
        <img
          src={logo}
          alt={name}
          className={`${dim} shrink-0 ${rounded} object-cover ring-1 ring-[var(--h-border)]`}
        />
      )
    }
    return (
      <div
        className={`${dim} flex shrink-0 items-center justify-center rounded-xl bg-[var(--h-accent-subtle)] font-semibold text-[var(--h-text)] ring-1 ring-[var(--h-border)]`}
      >
        {initial}
      </div>
    )
  }