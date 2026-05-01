import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const AUTH_PASSWORD = process.env.AUTH_PASSWORD
  if (!AUTH_PASSWORD) return NextResponse.next()

  const { pathname } = request.nextUrl
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth') || pathname.startsWith('/api/cron/')) {
    return NextResponse.next()
  }

  const auth = request.cookies.get('auth')
  if (!auth || auth.value !== AUTH_PASSWORD) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
