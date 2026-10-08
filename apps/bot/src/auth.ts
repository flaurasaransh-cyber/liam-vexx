import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { env } from './env.js'

// One admin password, set on the server. Signing in returns a signed token that lasts 7 days.
const DAY = 86_400_000
const sign = (payload: string) => createHmac('sha256', env.sessionSecret).update(payload).digest('base64url')

function same(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function passwordMatches(input: string) {
  return same(sign(`pw:${input}`), sign(`pw:${env.adminPassword}`))
}

export function issueToken() {
  const expires = String(Date.now() + 7 * DAY)
  return { token: `${expires}.${sign(expires)}`, expiresAt: new Date(Number(expires)).toISOString() }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const [expires, signature] = token.split('.')
  if (!expires || !signature || !same(signature, sign(expires)) || Number(expires) < Date.now()) {
    res.status(401).json({ error: 'Your session ended. Sign in again.' })
    return
  }
  next()
}

// A few wrong passwords from one address and it has to wait a while.
const attempts = new Map<string, { count: number; until: number }>()
export function tooManyAttempts(ip: string) {
  const a = attempts.get(ip)
  return Boolean(a && a.count >= 5 && a.until > Date.now())
}
export function recordFailure(ip: string) {
  const a = attempts.get(ip)
  const fresh = !a || a.until < Date.now()
  attempts.set(ip, { count: fresh ? 1 : a!.count + 1, until: Date.now() + 15 * 60_000 })
}
export function clearFailures(ip: string) {
  attempts.delete(ip)
}
