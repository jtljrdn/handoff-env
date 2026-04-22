import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useMatches,
  useRouter,
} from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import Footer from '../components/Footer'
import Header from '../components/Header'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import { Button } from '../components/ui/button'
import { Toaster } from '../components/ui/sonner'
import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      { title: 'Handoff · Environment variables for teams' },
      {
        name: 'description',
        content:
          'The simplest way to share environment variables with your team. Push, pull, done.',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
  notFoundComponent: NotFoundPage,
  errorComponent: ErrorPage,
})

function RootComponent() {
  const matches = useMatches()
  const isAuthed = matches.some((m) => m.routeId === '/_authed')

  return (
    <>
      {!isAuthed && <Header />}
      <Outlet />
      {!isAuthed && <Footer />}
    </>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // Static hardcoded string; no user input, safe from XSS
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <HeadContent />
      </head>
      <body className="font-sans antialiased [overflow-wrap:anywhere]">
        {children}
        <Toaster />
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-sm font-medium text-[var(--h-accent)]">
        404
      </p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-[var(--h-text)] sm:text-4xl">
        Page not found
      </h1>
      <p className="mt-3 max-w-sm text-base text-[var(--h-text-2)]">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link to="/">Go home</Link>
        </Button>
      </div>
    </div>
  )
}

function ErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter()

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-sm font-medium text-[var(--destructive-foreground)]">
        Error
      </p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-[var(--h-text)] sm:text-4xl">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-sm text-base text-[var(--h-text-2)]">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button
          variant="outline"
          onClick={() => {
            reset()
            router.invalidate()
          }}
        >
          Try again
        </Button>
        <Button variant="outline" onClick={() => {/* TODO: open error report/contact form */}}>
          Report issue
        </Button>
        <Button asChild>
          <Link to="/">Go home</Link>
        </Button>
      </div>
    </div>
  )
}
