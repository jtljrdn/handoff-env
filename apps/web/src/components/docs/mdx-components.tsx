import { Link } from '@tanstack/react-router'
import type { MDXComponents } from 'mdx/types'
import type { AnchorHTMLAttributes } from 'react'
import { Callout } from './Callout'
import { CodeBlock } from './CodeBlock'

function SmartLink({
  href,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (!href) return <a {...rest}>{children}</a>
  const isInternal = href.startsWith('/') || href.startsWith('#')
  if (isInternal && !href.startsWith('#')) {
    return (
      <Link to={href} {...rest}>
        {children}
      </Link>
    )
  }
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      {...rest}
    >
      {children}
    </a>
  )
}

export const mdxComponents: MDXComponents = {
  a: SmartLink,
  pre: CodeBlock,
  Callout,
}
