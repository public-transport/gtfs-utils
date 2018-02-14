'use strict'

const {DateTime} = require('luxon')

const test = require('tape')

const parseDate = require('./parse-date')
const daysBetween = require('./lib/days-between')

const utc = 'Etc/UTC'
const berlin = 'Europe/Berlin'

test('parse-date', (t) => {
	t.plan(3)
	t.equal(parseDate('20190303', utc), 1551571200)
	t.equal(parseDate('20190303', berlin), 1551567600)
	t.equal(parseDate('20190303', 'Asia/Bangkok'), 1551546000)
})

test('lib/days-between', (t) => {
	const march3rd = 1551567600 // Europe/Berlin
	const march4th = 1551654000 // Europe/Berlin
	const march5th = 1551740400 // Europe/Berlin
	const allWeekdays = {
		monday: true,
		tuesday: true,
		wednesday: true,
		thursday: true,
		friday: true,
		saturday: true,
		sunday: true
	}

	t.deepEqual(daysBetween('20190313', '20190303', allWeekdays, berlin), [])
	t.deepEqual(daysBetween('20190303', '20190303', allWeekdays, berlin), [
		march3rd
	])
	t.deepEqual(daysBetween('20190303', '20190305', allWeekdays, berlin), [
		march3rd,
		march4th,
		march5th
	])
	t.equal(daysBetween('20190303', '20190313', allWeekdays, berlin).length, 11)

	const many = daysBetween('20190303', '20190703', allWeekdays, berlin)
	for (let ts of many) {
		const d = DateTime.fromMillis(ts * 1000, {zone: berlin})
		if (d.hour !== 0) console.error(ts)
		t.equal(d.hour, 0)
		t.equal(d.minute, 0)
		t.equal(d.second, 0)
		t.equal(d.millisecond, 0)
	}

	t.end()
})

test('compute-trip-starts', (t) => {
	// todo
})
