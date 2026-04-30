import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const AUTH_PASSWORD = process.env.AUTH_PASSWORD

  if (!AUTH_PASSWORD || password !== AUTH_PASSWORD) {
    return NextResponse.json({ error: '비밀번호가 틀렸습니다' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('auth', AUTH_PASSWORD, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    sameSite: 'lax',
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('auth')
  return res
}
