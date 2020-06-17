'use strict'

const test = require('tape')

const resolveTime = require('../lib/resolve-time')

const TZ = 'Europe/Berlin'

const parseISO = iso => Date.parse(iso) / 1000 | 0

test('resolveTime: handles HH >24', (t) => {
	const T0 = 1559358000 // 2019-06-01T05:00:00+02:00
	t.equal(
		resolveTime(TZ, T0, {hours: 23, minutes: 59, seconds: 59}),
		parseISO('2019-06-01T23:59:59+02:00'),
	)
	t.equal(
		resolveTime(TZ, T0, {hours: 24, minutes: 0, seconds: 0}),
		parseISO('2019-06-02T00:00:00+02:00'),
	)
	t.equal(
		resolveTime(TZ, T0, {hours: 27, minutes: 59, seconds: 59}),
		parseISO('2019-06-02T03:59:59+02:00'),
	)
	t.equal(
		resolveTime(TZ, T0, 27 * 3600 + 59 * 60 + 59),
		parseISO('2019-06-02T03:59:59+02:00'),
	)
	t.end()
})

// see also https://gist.github.com/derhuerst/574edc94981a21ef0ce90713f1cff7f6
test('resolveTime: handles DST properly', (t) => {
	const T0 = 1572130800 // 2019-10-27T01:00:00+02:00
	const T1 = 1553990400 // 2019-03-31T01:00:00+01:00

	// DST -> standard time
	t.equal(
		resolveTime(TZ, T0, {hours: 0, minutes: 59, seconds: 59}),
		parseISO('2019-10-27T01:59:59+02:00'),
	)
	t.equal(
		resolveTime(TZ, T0, {hours: 1, minutes: 0, seconds: 0}),
		parseISO('2019-10-27T02:00:00+02:00'),
	)
	t.equal(
		resolveTime(TZ, T0, {hours: 1, minutes: 59, seconds: 59}),
		parseISO('2019-10-27T02:59:59+02:00'),
	)
	t.equal(
		resolveTime(TZ, T0, {hours: 2, minutes: 0, seconds: 0}),
		parseISO('2019-10-27T02:00:00+01:00'),
	)
	t.equal(
		resolveTime(TZ, T0, {hours: 2, minutes: 59, seconds: 59}),
		parseISO('2019-10-27T02:59:59+01:00'),
	)
	t.equal(
		resolveTime(TZ, T0, {hours: 3, minutes: 0, seconds: 0}),
		parseISO('2019-10-27T03:00:00+01:00'),
	)

	// standard time -> DST
	t.equal(
		resolveTime(TZ, T1, {hours: 2, minutes: 0, seconds: 0}),
		parseISO('2019-03-31T01:00:00+01:00'),
	)
	t.equal(
		resolveTime(TZ, T1, {hours: 2, minutes: 59, seconds: 59}),
		parseISO('2019-03-31T01:59:59+01:00'),
	)
	t.equal(
		resolveTime(TZ, T1, {hours: 3, minutes: 0, seconds: 0}),
		parseISO('2019-03-31T03:00:00+02:00'),
	)

	t.end()
})
