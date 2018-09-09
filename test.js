'use strict'

const {DateTime} = require('luxon')
const test = require('tape')

const readCsv = require('./read-csv')
const parseDate = require('./parse-date')
const parseTime = require('./parse-time')
const daysBetween = require('./lib/days-between')
// const computeStopoverTimes = require('./compute-stopover-times')
const computeSortedConnections = require('./compute-sorted-connections')

// const data = {
// 	services: require('sample-gtfs-feed/json/calendar.json'),
// 	exceptions: require('sample-gtfs-feed/json/calendar_dates.json'),
// 	trips: require('sample-gtfs-feed/json/trips.json'),
// 	stopovers: require('sample-gtfs-feed/json/stop_times.json')
// }
const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

const utc = 'Etc/UTC'
const berlin = 'Europe/Berlin'

test('parse-date', (t) => {
	t.plan(3)
	t.equal(parseDate('20190303', utc), 1551571200)
	t.equal(parseDate('20190303', berlin), 1551567600)
	t.equal(parseDate('20190303', 'Asia/Bangkok'), 1551546000)
})

test('parse-time', (t) => {
	t.plan(3 + 2)
	t.throws(() => parseTime())
	t.throws(() => parseTime(''))
	t.throws(() => parseTime('1:2:3'))
	t.deepEqual(parseTime('21:30'), {hours: 21, minutes: 30, seconds: null})
	t.deepEqual(parseTime('21:30:01'), {hours: 21, minutes: 30, seconds: 1})
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
	t.ok(Array.isArray(many))
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

test('compute-stopover-times', (t) => {
	// todo
	t.end()
})

test('compute-sorted-connections', (t) => {
	const from = 1552324800
	const to = 1552393000

	computeSortedConnections(readFile, {}, 'Europe/Berlin')
	.then((sortedConnections) => {
		const connections = []
		sortedConnections.range(from, to, node => {
			connections.push(node.data)
			return false // continue walking the build
		})

		t.deepEqual(connections, [{
			fromStop: 'lake',
			departure: 1552324920,
			toStop: 'airport',
			arrival: 1552325400,
			routeId: 'B',
			serviceId: 'on-working-days'
		},
		{
			fromStop: 'airport',
			departure: 1552392840,
			toStop: 'lake',
			arrival: 1552393200,
			routeId: 'B',
			serviceId: 'on-working-days'
		}])
		t.end()
	})
	.catch(t.ifError)
})
