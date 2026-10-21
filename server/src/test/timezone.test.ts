import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  getTimeZoneOffsetMs,
  getZonedParts,
  isValidTimeZone,
  resolveTimeZone,
  zonedAdd,
  zonedTruncate,
} from '../utils/timezone.js'

describe('resolveTimeZone', () => {
  it('keeps a zone the runtime understands', () => {
    assert.equal(resolveTimeZone('America/New_York'), 'America/New_York')
    assert.equal(resolveTimeZone('UTC'), 'UTC')
  })

  it('falls back to UTC for anything else', () => {
    assert.equal(resolveTimeZone('Not/AZone'), 'UTC')
    assert.equal(resolveTimeZone(''), 'UTC')
    assert.equal(resolveTimeZone(undefined), 'UTC')
    assert.equal(resolveTimeZone(null), 'UTC')
  })

  it('recognises valid zones', () => {
    assert.equal(isValidTimeZone('Asia/Kolkata'), true)
    assert.equal(isValidTimeZone('Not/AZone'), false)
    assert.equal(isValidTimeZone(''), false)
  })
})

describe('getZonedParts', () => {
  it('reads the wall clock in the requested zone', () => {
    const parts = getZonedParts(new Date('2026-03-20T12:00:00.000Z'), 'America/New_York')

    assert.equal(parts.year, 2026)
    assert.equal(parts.month, 3)
    assert.equal(parts.day, 20)
    assert.equal(parts.hour, 8)
  })

  it('reports the offset of a zone', () => {
    // New York is UTC-5 in winter and UTC-4 in summer.
    assert.equal(getTimeZoneOffsetMs(new Date('2026-01-15T12:00:00.000Z'), 'America/New_York'), -5 * 3600_000)
    assert.equal(getTimeZoneOffsetMs(new Date('2026-07-15T12:00:00.000Z'), 'America/New_York'), -4 * 3600_000)
    // Kolkata is UTC+5:30 all year.
    assert.equal(getTimeZoneOffsetMs(new Date('2026-07-15T12:00:00.000Z'), 'Asia/Kolkata'), 5.5 * 3600_000)
  })
})

describe('zonedTruncate', () => {
  it('snaps to the local day', () => {
    const start = zonedTruncate(new Date('2026-03-20T12:00:00.000Z'), 'day', 'America/New_York')

    assert.equal(start.toISOString(), '2026-03-20T04:00:00.000Z')
  })

  it('snaps to the local month', () => {
    const start = zonedTruncate(new Date('2026-03-20T12:00:00.000Z'), 'month', 'America/New_York')

    assert.equal(start.toISOString(), '2026-03-01T05:00:00.000Z')
  })

  it('snaps to the local year', () => {
    const start = zonedTruncate(new Date('2026-03-20T12:00:00.000Z'), 'year', 'America/New_York')

    assert.equal(start.toISOString(), '2026-01-01T05:00:00.000Z')
  })

  it('snaps back to the Sunday of the week', () => {
    // 2026-03-20 is a Friday, so the week starts on 2026-03-15.
    const start = zonedTruncate(new Date('2026-03-20T12:00:00.000Z'), 'week', 'UTC')

    assert.equal(start.toISOString(), '2026-03-15T00:00:00.000Z')
  })

  it('keeps the local day when the zone changes its offset', () => {
    // New York moves to daylight saving time on 2026-03-08.
    const start = zonedTruncate(new Date('2026-03-08T12:00:00.000Z'), 'day', 'America/New_York')

    assert.equal(getZonedParts(start, 'America/New_York').hour, 0)
    assert.equal(start.toISOString(), '2026-03-08T05:00:00.000Z')
  })
})

describe('zonedAdd', () => {
  it('keeps the wall clock across a daylight saving change', () => {
    // New York moves to daylight saving time at 02:00 on 2026-03-08.
    const before = zonedTruncate(new Date('2026-03-07T12:00:00.000Z'), 'day', 'America/New_York')
    const after = zonedAdd(before, 'day', 1, 'America/New_York')

    assert.equal(getZonedParts(after, 'America/New_York').day, 8)
    assert.equal(getZonedParts(after, 'America/New_York').hour, 0)
    assert.equal(after.toISOString(), '2026-03-08T05:00:00.000Z')
    assert.equal(after.getTime() - before.getTime(), 24 * 3600_000)

    // The day the clocks change is one hour shorter.
    const short = zonedAdd(after, 'day', 1, 'America/New_York')

    assert.equal(short.toISOString(), '2026-03-09T04:00:00.000Z')
    assert.equal(short.getTime() - after.getTime(), 23 * 3600_000)
  })

  it('adds months', () => {
    const start = zonedTruncate(new Date('2026-01-15T12:00:00.000Z'), 'month', 'UTC')
    const added = zonedAdd(start, 'month', 2, 'UTC')

    assert.equal(added.toISOString(), '2026-03-01T00:00:00.000Z')
  })

  it('clamps the end of a month', () => {
    const start = new Date('2026-01-31T12:00:00.000Z')
    const added = zonedAdd(start, 'month', 1, 'UTC')

    assert.equal(added.toISOString(), '2026-02-28T12:00:00.000Z')
  })
})
