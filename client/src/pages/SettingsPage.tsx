import { useState } from 'react'
import { Bell, Database, Info, LogOut, Palette, ShieldCheck, User } from 'lucide-react'

import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Toggle } from '@/components/ui/Toggle'
import { useAppConfig } from '@/config/app-config'
import { config } from '@/config/env'
import { initialsOf } from '@/lib/user'

const currencyOptions = [
  { value: 'usd', label: 'USD — US Dollar' },
  { value: 'eur', label: 'EUR — Euro' },
  { value: 'gbp', label: 'GBP — British Pound' },
  { value: 'inr', label: 'INR — Indian Rupee' },
]

const dateFormatOptions = [
  { value: 'mmm-dd-yyyy', label: 'MMM DD, YYYY' },
  { value: 'dd-mmm-yyyy', label: 'DD MMM, YYYY' },
  { value: 'yyyy-mm-dd', label: 'YYYY-MM-DD' },
]

export function SettingsPage() {
  const { simulateApiErrors, setSimulateApiErrors } = useAppConfig()
  const { user, signOut } = useAuth()
  const [currency, setCurrency] = useState('usd')
  const [dateFormat, setDateFormat] = useState('mmm-dd-yyyy')
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(true)
  const [budgetAlerts, setBudgetAlerts] = useState(false)

  const isDemo = config.dataSource !== 'api'
  const name = user?.name ?? 'Alex Doe'
  const email = user?.email ?? 'alex@example.com'

  return (
    <>
      <PageHeader
        title="Settings"
        description="Profile, preferences and how Spendly sources your data."
      />

      {isDemo ? (
        <div
          role="note"
          className="mb-4 flex items-start gap-3 rounded-card border border-info/25 bg-info/8 px-4 py-3 text-sm text-info"
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="leading-relaxed">
            This preview build stores nothing. The controls below illustrate the settings surface —
            values are not written to an account, a database or a server.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Profile"
            description="How you appear across Spendly"
            actions={
              <span className="flex size-8 items-center justify-center rounded-full border border-line bg-surface-3 text-[11px] font-semibold text-ink-muted">
                {initialsOf(name)}
              </span>
            }
          />
          <div className="grid gap-4 px-5 pb-5">
            <Input label="Full name" value={name} readOnly={!isDemo} />
            <Input
              label="Email"
              type="email"
              value={email}
              readOnly={!isDemo}
              hint={isDemo ? 'Used for receipts and alerts.' : 'Your sign-in address.'}
            />

            {isDemo ? (
              <div className="flex justify-end">
                <Button variant="secondary" size="sm">
                  Save profile
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs leading-relaxed text-ink-faint">
                  Your profile is managed by your account.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<LogOut className="size-4" aria-hidden="true" />}
                  onClick={() => {
                    void signOut()
                  }}
                >
                  Sign out
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Preferences"
            description="Formatting and regional defaults"
            actions={<Palette className="size-4 text-ink-faint" aria-hidden="true" />}
          />
          <div className="grid gap-4 px-5 pb-5">
            <Select
              label="Display currency"
              options={currencyOptions}
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            />
            <Select
              label="Date format"
              options={dateFormatOptions}
              value={dateFormat}
              onChange={(event) => setDateFormat(event.target.value)}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Notifications"
            description="Choose what Spendly tells you about"
            actions={<Bell className="size-4 text-ink-faint" aria-hidden="true" />}
          />
          <div className="space-y-5 px-5 pb-5">
            <Toggle
              id="notify-email"
              checked={emailAlerts}
              onChange={setEmailAlerts}
              label="Transaction alerts"
              description="A note for every purchase above your usual amount."
            />
            <Toggle
              id="notify-digest"
              checked={weeklyDigest}
              onChange={setWeeklyDigest}
              label="Weekly digest"
              description="A short summary of the week ahead of Monday."
            />
            <Toggle
              id="notify-budgets"
              checked={budgetAlerts}
              onChange={setBudgetAlerts}
              label="Budget warnings"
              description="Warn me when a category crosses 85% of its limit."
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Data source"
            description="Where Spendly reads your figures from"
            actions={<Database className="size-4 text-ink-faint" aria-hidden="true" />}
          />
          <div className="space-y-5 px-5 pb-5">
            <div className="flex items-start justify-between gap-4 rounded-control border border-line bg-surface-2 px-3.5 py-3">
              <div>
                <p className="text-sm font-medium text-ink">Current source</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-faint">
                  {config.dataSource === 'mock'
                    ? 'Sample data bundled with the app. Reads only, nothing persisted.'
                    : `Live API at ${config.apiBaseUrl}.`}
                </p>
              </div>
              <Badge tone={config.dataSource === 'mock' ? 'brand' : 'positive'}>
                {config.dataSource === 'mock' ? 'Sample data' : 'API'}
              </Badge>
            </div>

            <Toggle
              id="simulate-errors"
              checked={simulateApiErrors}
              onChange={setSimulateApiErrors}
              label="Simulate API failures"
              description="Frontend-only switch that makes the sample source fail on purpose, so you can review the error states."
            />

            <div className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-faint">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <p>
                {isDemo
                  ? 'No credentials are stored, and no data leaves this browser in the current build.'
                  : 'Your session lives in an HTTP-only cookie. No token is ever written to localStorage.'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 flex items-center gap-2.5 text-xs text-ink-faint">
        <User className="size-3.5" aria-hidden="true" />
        Signed in as <span className="font-medium text-ink-muted">{email}</span>
      </div>
    </>
  )
}
