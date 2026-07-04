import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GraduationCap, Loader2, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchDevOtp,
  requestOtp,
  resendOtp,
  trustedLogin,
  verifyOtp,
  type VerifyOtpInput,
} from '@/api/auth'
import { updateProfile } from '@/api/users'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { env } from '@/lib/env'
import { errorMessage } from '@/lib/error-messages'
import { isApiError } from '@/types/api'
import type { Session, User } from '@/types/models'
import { useAuthStore } from '@/stores/auth.store'
import { useCountdown } from '@/hooks/use-countdown'
import { defaultDeviceName } from '@/features/auth/device-name'
import { SessionLimitDialog } from '@/features/auth/SessionLimitDialog'

type Step = 'email' | 'otp' | 'name'

export function LoginPage() {
  const setUser = useAuthStore((s) => s.setUser)
  const [searchParams] = useSearchParams()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [rememberDevice, setRememberDevice] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cooldown = useCountdown()

  // First-login name capture: hold the user locally so RedirectIfAuthed
  // doesn't navigate away before we've asked for their name.
  const [pendingUser, setPendingUser] = useState<User | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  // Session-limit recovery state: which call to retry after the user revokes a device.
  const [limitSessions, setLimitSessions] = useState<Session[] | null>(null)
  const [limitSource, setLimitSource] = useState<'otp' | 'trusted'>('otp')

  const finishLogin = (user: User) => {
    if (!user.name) {
      // The session cookie is already set; delay the store update until
      // the name step is done so the auth guard doesn't redirect early.
      setPendingUser(user)
      setStep('name')
      return
    }
    // RedirectIfAuthed navigates to ?next= (or the role default) once status flips.
    setUser(user)
    toast.success(`Welcome, ${user.name}!`)
  }

  const submitName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pendingUser) return
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
    setBusy(true)
    setError(null)
    try {
      const { user: updated } = await updateProfile({ name: fullName })
      setUser(updated)
      toast.success(`Welcome, ${firstName.trim()}!`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const skipName = () => {
    if (!pendingUser) return
    setUser(pendingUser)
    toast.success('Welcome!')
  }

  const handleSessionLimit = (err: unknown, source: 'otp' | 'trusted'): boolean => {
    if (isApiError(err, 'SESSION_LIMIT_EXCEEDED')) {
      const details = err.details as { activeSessions?: Session[] } | undefined
      setLimitSessions(details?.activeSessions ?? [])
      setLimitSource(source)
      return true
    }
    return false
  }

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      // Known device? Skip the OTP entirely.
      const { user } = await trustedLogin(email)
      finishLogin(user)
      return
    } catch (err) {
      if (handleSessionLimit(err, 'trusted')) {
        setBusy(false)
        return
      }
      // Fall through to the OTP flow for any other failure.
    }
    try {
      const { cooldown: wait } = await requestOtp(email)
      cooldown.start(wait)
      setStep('otp')
      setOtp('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const submitOtp = async (input?: Partial<VerifyOtpInput>) => {
    setError(null)
    setBusy(true)
    try {
      const { user } = await verifyOtp({
        email,
        otp,
        deviceName: defaultDeviceName(),
        rememberDevice,
        ...input,
      })
      setLimitSessions(null)
      finishLogin(user)
    } catch (err) {
      if (handleSessionLimit(err, 'otp')) return
      if (isApiError(err, 'OTP_EXPIRED') || isApiError(err, 'OTP_NOT_REQUESTED')) {
        setLimitSessions(null)
        setStep('email')
        setError('Your code expired. Enter your email to get a new one.')
        return
      }
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleRevokeAndRetry = async (sessionId: string) => {
    if (limitSource === 'trusted') {
      try {
        const { user } = await trustedLogin(email, sessionId)
        setLimitSessions(null)
        finishLogin(user)
      } catch (err) {
        if (handleSessionLimit(err, 'trusted')) return
        // Trusted retry failed (e.g. device no longer trusted) — fall back to OTP.
        setLimitSessions(null)
        try {
          const { cooldown: wait } = await requestOtp(email)
          cooldown.start(wait)
          setStep('otp')
        } catch (otpErr) {
          setError(errorMessage(otpErr))
        }
      }
      return
    }
    await submitOtp({ revokeSessionId: sessionId })
  }

  const handleResend = async () => {
    setError(null)
    try {
      const { cooldown: wait } = await resendOtp(email)
      cooldown.start(wait)
      toast.success('A new code is on its way')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const handleDevOtp = async () => {
    try {
      const { otp: code } = await fetchDevOtp(email)
      setOtp(code)
    } catch (err) {
      setError(errorMessage(err, 'Could not fetch the dev OTP'))
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center pt-8 sm:pt-16">
      <div className="bg-primary/10 mb-6 flex size-14 items-center justify-center rounded-2xl">
        <GraduationCap className="text-primary size-7" />
      </div>
      <Card className="w-full">
        {step === 'name' ? (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">What should we call you?</CardTitle>
              <CardDescription>
                Your name appears on comments and helps your mentor know you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitName} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First name</Label>
                    <Input
                      id="first-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                      maxLength={60}
                      autoFocus
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last name</Label>
                    <Input
                      id="last-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      autoComplete="family-name"
                      maxLength={60}
                    />
                  </div>
                </div>
                {error && <p className="text-destructive text-sm">{error}</p>}
                <Button type="submit" className="w-full" disabled={busy || !firstName.trim()}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  Continue
                </Button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground mx-auto block text-sm"
                  onClick={skipName}
                >
                  Skip for now
                </button>
              </form>
            </CardContent>
          </>
        ) : step === 'email' ? (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Welcome to BrightMango</CardTitle>
              <CardDescription>
                Enter your email — we'll send you a one-time code. No password needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                {error && <p className="text-destructive text-sm">{error}</p>}
                <Button type="submit" className="w-full" disabled={busy || !email}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  Continue
                </Button>
              </form>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Check your email</CardTitle>
              <CardDescription>
                We sent a 6-digit code to <span className="font-medium">{email}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void submitOtp()
                }}
                className="space-y-4"
              >
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus>
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberDevice}
                    onCheckedChange={(v) => setRememberDevice(v === true)}
                  />
                  <Label htmlFor="remember" className="text-sm font-normal">
                    Remember this device
                  </Label>
                </div>
                {error && <p className="text-destructive text-sm">{error}</p>}
                <Button type="submit" className="w-full" disabled={busy || otp.length !== 6}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  Sign in
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setStep('email')
                      setError(null)
                    }}
                  >
                    Use a different email
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                    disabled={cooldown.active}
                    onClick={handleResend}
                  >
                    {cooldown.active ? `Resend in ${cooldown.seconds}s` : 'Resend code'}
                  </button>
                </div>
                {env.isDev && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleDevOtp}
                  >
                    <Wand2 className="size-3.5" />
                    Fetch dev OTP
                  </Button>
                )}
              </form>
            </CardContent>
          </>
        )}
      </Card>
      {searchParams.get('next') && (
        <p className="text-muted-foreground mt-4 text-center text-xs">
          You'll be taken back to where you left off after signing in.
        </p>
      )}

      <SessionLimitDialog
        open={limitSessions !== null}
        onOpenChange={(open) => !open && setLimitSessions(null)}
        sessions={limitSessions ?? []}
        onRevoke={handleRevokeAndRetry}
      />
    </div>
  )
}
