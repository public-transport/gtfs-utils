'use strict'

const test = require('tape')

const parseDate = require('./parse-date')
const daysBetween = require('./lib/days-between')

const utc = 'Etc/UTC'
const berlin = 'Europe/Berlin'
const march3rd = 1551571200 // UTC
const march4th = 1551657600 // UTC
const march5th = 1551744000 // UTC

test('parse-date', (t) => {
	t.plan(3)
	t.equal(parseDate('20190303', utc), 1551571200)
	t.equal(parseDate('20190303', berlin), 1551567600)
	t.equal(parseDate('20190303', 'Asia/Bangkok'), 1551546000)
})

test('lib/days-between', (t) => {
	t.plan(4)
	const allWeekdays = {
		monday: true,
		tuesday: true,
		wednesday: true,
		thursday: true,
		friday: true,
		saturday: true,
		sunday: true
	}

	t.deepEqual(daysBetween('20190313', '20190303', allWeekdays, utc), [])
	t.deepEqual(daysBetween('20190303', '20190303', allWeekdays, utc), [march3rd])
	t.deepEqual(daysBetween('20190303', '20190305', allWeekdays, utc), [
		march3rd,
		march4th,
		march5th
	])
	t.equal(daysBetween('20190303', '20190313', allWeekdays, utc).length, 11)
})

test('compute-trip-starts', (t) => {
	// todo
})
