'use strict'

const {DateTime} = require('luxon')
const test = require('tape')
const {createReadStream} = require('fs')
const {join: pathJoin} = require('path')
const {readJSON5Sync, readFilesFromFixture} = require('./lib')

const readCsv = require('../read-csv')
const inMemStore = require('../lib/in-memory-store')
const formatDate = require('../format-date')
const datesBetween = require('../lib/dates-between')
const resolveTime = require('../lib/resolve-time')
const readStopTimezones = require('../lib/read-stop-timezones')
const readServicesAndExceptions = require('../read-services-and-exceptions')
const computeStopovers = require('../compute-stopovers')
const computeSortedConnections = require('../compute-sorted-connections')
const computeServiceBreaks = require('../compute-service-breaks')
const {extendedToBasic} = require('../route-types')
const optimiseServicesAndExceptions = require('../optimise-services-and-exceptions')

const testWithFixtures = (fn, fixtures, prefix = '') => {
	fixtures.forEach((f) => {
		const title = [prefix, f.title].filter(s => !!s).join(' – ')
		const args = f.args.map(a => a[1]) // select values
		const testFn = f.fails
			? (t) => {
				t.plan(1)
				t.throws(() => fn(...args))
			}
			: (t) => {
				t.plan(1)
				t.deepEqual(fn(...args), f.result)
			}
		test(title, testFn)
	})
}

testWithFixtures(
	require('../parse-date'),
	readJSON5Sync(require.resolve('./fixtures/parse-date.json5')),
	'parse-date',
)

testWithFixtures(
	require('../parse-time'),
	readJSON5Sync(require.resolve('./fixtures/parse-time.json5')),
	'parse-time',
)

testWithFixtures(
	require('../lib/resolve-time'),
	readJSON5Sync(require.resolve('./fixtures/resolve-time.json5')),
	'resolve-time',
)

require('./iterate-matching')

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

test('read-csv: accept a readable stream as input', async (t) => {
	const readable = createReadStream(require.resolve('sample-gtfs-feed/gtfs/stops.txt'))
	const src = await readCsv(readable)

	const stop = await new Promise(res => src.once('data', res))
	t.ok(stop)
	t.ok(stop.stop_id)
	src.destroy()
})

test('read-csv: rejects on ENOENT', async (t) => {
	let rejected = false
	const p = readCsv(pathJoin(__dirname, '_non-existent_'))
	await p.catch((err) => {
		rejected = true
		t.ok(err, 'err')
		t.equal(err.code, 'ENOENT', 'err.code')
	})
	t.equal(rejected, true, 'did not reject')
})

test('format-date', (t) => {
	t.plan(3)
	t.equal(formatDate(1551571200, utc), '20190303')
	t.equal(formatDate(1551567600, berlin), '20190303')
	t.equal(formatDate(1551546000, 'Asia/Bangkok'), '20190303')
})

test('lib/dates-between', (t) => {
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

	t.deepEqual(datesBetween('20190313', '20190303', allWeekdays, berlin), [])
	t.deepEqual(datesBetween('20190303', '20190303', allWeekdays, berlin), [
		'2019-03-03',
	])
	t.deepEqual(datesBetween('20190303', '20190305', allWeekdays, berlin), [
		'2019-03-03',
		'2019-03-04',
		'2019-03-05',
	])
	t.equal(datesBetween('20190303', '20190313', allWeekdays, berlin).length, 11)

	t.end()
})

test('lib/resolve-time', (t) => {
	const r = resolveTime
	const _ = iso => Date.parse(iso) / 1000
	const tzA = 'Europe/Berlin'
	const dateA = '2021-02-02'
	const tzB = 'Asia/Bangkok'
	const dateB = '2021-03-03'
	const time1 = 3 * 3600 + 2 * 60 + 1 // 03:02:01
	const time2 = 26 * 3600 // 26:00

	t.equal(r(tzA, dateA, time1), _('2021-02-02T03:02:01+01:00'))
	t.equal(r(tzA, dateA, time2), _('2021-02-03T02:00+01:00'))
	t.equal(r(tzB, dateA, time1), _('2021-02-02T03:02:01+07:00'))
	t.equal(r(tzB, dateA, time2), _('2021-02-03T02:00+07:00'))
	t.equal(r(tzB, dateB, time1), _('2021-03-03T03:02:01+07:00'))
	t.equal(r(tzB, dateB, time2), _('2021-03-04T02:00+07:00'))
	t.end()
})

test('lib/read-stop-timezones', async (t) => {
	const readFile = readFilesFromFixture('timezones')
	const filters = {stop: () => true}
	const tzs = await readStopTimezones(readFile, filters, inMemStore)

	const actual = Object.fromEntries(Array.from(tzs.raw.entries()))
	t.deepEqual(actual, {
		's2': 'Europe/Berlin',
		's3': 'Europe/London',
		's3a': 'Europe/London',
		's3b': 'Europe/London',
	})
})

require('./read-stop-times')

const servicesFixtures = readJSON5Sync(require.resolve('./fixtures/services.json5'))
test('read-services-and-exceptions: works', async (t) => {
	const services = readServicesAndExceptions(readFile, 'Europe/Berlin')
	const res = {}
	for await (const [id, dates] of services) res[id] = dates

	t.deepEqual(res, servicesFixtures)
})

test('read-services-and-exceptions: works with calendar only', async (t) => {
	const readFile = readFilesFromFixture('calendar-only')

	const services = readServicesAndExceptions(readFile, 'Europe/Berlin')
	const res = {}
	for await (const [id, dates] of services) res[id] = dates

	t.deepEqual(res, {
		a: [
			'2021-05-01', '2021-05-02', '2021-05-03', '2021-05-04',
			'2021-05-05', '2021-05-06', '2021-05-07', '2021-05-08',
			'2021-05-09', '2021-05-10',
		],
		b: ['2021-06-06'],
		c: ['2021-05-04', '2021-05-11'],
	})
})

// todo: what if readFile throws ENOENT synchronously?
test('read-services-and-exceptions: works with calendar_dates only', async (t) => {
	const readFile = readFilesFromFixture('calendar-dates-only')

	const services = readServicesAndExceptions(readFile, 'Europe/Berlin')
	const res = {}
	for await (const [id, dates] of services) res[id] = dates

	t.deepEqual(res, {
		a: ['2021-05-31', '2021-06-01', '2021-06-11', '2021-07-19'],
		b: [
			'2021-05-31', '2021-06-01', '2021-06-22', '2021-06-28',
			'2021-06-29', '2021-07-16', '2021-08-02',
		],
	})
})

test('read-services-and-exceptions: works with calendar_dates rows "before" first calendar row', async (t) => {
	const readFile = readFilesFromFixture('leading-exceptions')

	const services = readServicesAndExceptions(readFile, 'Europe/Berlin')
	const res = {}
	for await (const [id, dates] of services) res[id] = dates

	t.deepEqual(res, {
		// leading exceptions
		a: ['2021-06-06'],
		b: ['2021-06-08'],
		c: [
			'2021-06-05', '2021-06-06', '2021-06-07',
		],
	})
})

test('read-services-and-exceptions: works with calendar_dates rows "after" last calendar row', async (t) => {
	const readFile = readFilesFromFixture('trailing-exceptions')

	const services = readServicesAndExceptions(readFile, 'Europe/Berlin')
	const res = {}
	for await (const [id, dates] of services) res[id] = dates

	t.deepEqual(res, {
		c: [
			'2021-06-05', '2021-06-06', '2021-06-07',
		],
		// trailing exceptions
		d: ['2021-06-06'],
		e: ['2021-06-08'],
	})
})

test('read-services-and-exceptions: exposes service correctly', async (t) => {
	const readFile = readFilesFromFixture('optimise-services-and-exceptions')

	const services = readServicesAndExceptions(readFile, 'Europe/Berlin')
	const res = {}

	const baseSvc = {
		monday: '0',
		tuesday: '0',
		wednesday: '0',
		thursday: '0',
		friday: '0',
		saturday: '0',
		sunday: '0',
		start_date: '20220301', end_date: '20220410',
	}
	const expected = {
		'more-exceptions-than-regular': {
			...baseSvc,
			service_id: 'more-exceptions-than-regular',
			wednesday: '1',
			thursday: '1',
		},
		'more-regular-than-exceptions': {
			...baseSvc,
			service_id: 'more-regular-than-exceptions',
			friday: '1',
		},
		'should-stay-unchanged': {
			...baseSvc,
			service_id: 'should-stay-unchanged',
			tuesday: '1',
			saturday: '1',
		},
	}
	for await (const [id, _, svc] of services) {
		t.deepEqual(svc, expected[id], id)
	}
})

test('lib/dates-between mutation bug', async (t) => {
	const readFile = (file) => {
		return readCsv(pathJoin(__dirname, 'fixtures', 'services-and-exceptions', file + '.txt'))
	}

	const services = readServicesAndExceptions(readFile, 'Europe/Berlin')
	const res = Object.create(null)
	for await (const [svcId, dates] of services) {
		if (svcId === 'T2#122' || svcId === 'T0#133') console.log(svcId, dates)
		res[svcId] = dates
	}

	t.deepEqual(res['T2#122'], [
		'2021-06-05', '2021-06-12', '2021-06-19', '2021-06-26',
		'2021-07-03', '2021-07-10', '2021-07-17', '2021-07-24',
		'2021-07-31', '2021-08-07', '2021-08-14', '2021-08-21',
		'2021-08-28',
	])
	t.deepEqual(res['T0#133'], [
		'2021-05-31', '2021-06-01', '2021-06-02', '2021-06-04',
		'2021-06-07', '2021-06-08', '2021-06-09', '2021-06-10',
		'2021-06-11', '2021-06-14', '2021-06-15', '2021-06-16',
		'2021-06-17', '2021-06-18', '2021-06-21', '2021-06-22',
		'2021-06-23', '2021-06-24', '2021-06-25', '2021-06-28',
		'2021-06-29', '2021-06-30', '2021-07-01', '2021-07-02',
		'2021-07-05', '2021-07-06', '2021-07-07', '2021-07-08',
		'2021-07-09', '2021-07-12', '2021-07-13', '2021-07-14',
		'2021-07-15', '2021-07-16', '2021-07-19', '2021-07-20',
		'2021-07-21', '2021-07-22', '2021-07-23', '2021-07-26',
		'2021-07-27', '2021-07-28', '2021-07-29', '2021-07-30',
		'2021-08-02', '2021-08-03', '2021-08-04', '2021-08-05',
		'2021-08-06', '2021-08-09', '2021-08-10', '2021-08-11',
		'2021-08-12', '2021-08-13', '2021-08-16', '2021-08-17',
		'2021-08-18', '2021-08-19', '2021-08-20', '2021-08-23',
		'2021-08-24', '2021-08-25', '2021-08-26', '2021-08-27',
		'2021-08-30',
	])
})

const stopoversFixtures = readJSON5Sync(require.resolve('./fixtures/stopovers.json5'))
test('compute-stopovers: works', async (t) => {
	const stopovers = computeStopovers(readFile, 'Europe/Berlin', {
		trip: t => t.trip_id === 'b-downtown-on-working-days',
	})
	const res = []
	for await (const s of stopovers) res.push(s)

	t.deepEqual(res, stopoversFixtures)
})

test('compute-stopovers: handles DST switch properly', async (t) => {
	const readFile = readFilesFromFixture('daylight-saving-time')
	const stopovers = computeStopovers(readFile, 'Europe/Berlin')

	const res = []
	for await (const s of stopovers) res.push(s)
	t.deepEqual(res, [{
		stop_id: '1',
		trip_id: 'A1',
		service_id: 'sA',
		route_id: 'A',
		shape_id: undefined,
		start_of_trip: '2019-10-27',
		arrival: 1572137940, // 2019-10-27T02:59:00+02:00
		departure: 1572138060, // 2019-10-27T02:01:00+01:00
	}, {
		stop_id: '2',
		trip_id: 'A1',
		service_id: 'sA',
		route_id: 'A',
		shape_id: undefined,
		start_of_trip: '2019-10-27',
		arrival: 1572141540, // 2019-10-27T02:59:00+01:00
		departure: 1572141660, // 2019-10-27T03:01:00+01:00
	}, {
		stop_id: '2',
		trip_id: 'B1',
		service_id: 'sB',
		route_id: 'B',
		shape_id: undefined,
		start_of_trip: '2019-03-31',
		arrival: 1553990340, // 2019-03-31T00:59:00+01:00
		departure: 1553990460, // 2019-03-31T01:01:00+01:00
	}, {
		stop_id: '1',
		trip_id: 'B1',
		service_id: 'sB',
		route_id: 'B',
		shape_id: undefined,
		start_of_trip: '2019-03-31',
		arrival: 1553993940, // 2019-03-31T01:59:00+01:00
		departure: 1553994060,// 2019-03-31T03:01:00+02:00
	}])
})

test('compute-stopovers: handles timezones properly', async (t) => {
	const readFile = readFilesFromFixture('timezones')
	const stopovers = computeStopovers(readFile, 'Europe/Berlin') // todo: remove fallback timezone

	const res = []
	for await (const s of stopovers) res.push(s)
	t.equal(res.length, 8, 'res must have 8 items')

	t.deepEqual(res[0], { // todo: don't slice
		service_id: 's1',
		stop_id: 's1',
		trip_id: 't1',
		route_id: 'r1',
		shape_id: undefined,
		start_of_trip: '2021-02-02',
		arrival: Date.parse('2021-02-02T04:00+01:00') / 1000,
		departure: Date.parse('2021-02-02T04:01+01:00') / 1000,
	})
	t.deepEqual(res[1], {
		stop_id: 's2',
		trip_id: 't1',
		service_id: 's1',
		route_id: 'r1',
		shape_id: undefined,
		start_of_trip: '2021-02-02',
		arrival: Date.parse('2021-02-02T04:20+01:00') / 1000,
		departure: Date.parse('2021-02-02T04:21+01:00') / 1000,
	})
	t.deepEqual(res[2], {
		stop_id: 's1',
		trip_id: 't2',
		service_id: 's1',
		route_id: 'r2',
		shape_id: undefined,
		start_of_trip: '2021-02-02',
		arrival: Date.parse('2021-02-02T08:00+01:00') / 1000,
		departure: Date.parse('2021-02-02T08:01+01:00') / 1000,
	})
	t.deepEqual(res[3], {
		stop_id: 's3',
		trip_id: 't2',
		service_id: 's1',
		route_id: 'r2',
		shape_id: undefined,
		start_of_trip: '2021-02-02',
		arrival: Date.parse('2021-02-02T07:20+00:00') / 1000,
		departure: Date.parse('2021-02-02T07:21+00:00') / 1000,
	})
	t.deepEqual(res[4], {
		stop_id: 's1',
		trip_id: 't3',
		service_id: 's1',
		route_id: 'r3',
		shape_id: undefined,
		start_of_trip: '2021-02-02',
		arrival: Date.parse('2021-02-02T12:00+01:00') / 1000,
		departure: Date.parse('2021-02-02T12:01+01:00') / 1000,
	})
	t.deepEqual(res[5], {
		stop_id: 's3a',
		trip_id: 't3',
		service_id: 's1',
		route_id: 'r3',
		shape_id: undefined,
		start_of_trip: '2021-02-02',
		arrival: Date.parse('2021-02-02T11:20+00:00') / 1000,
		departure: Date.parse('2021-02-02T11:21+00:00') / 1000,
	})
	t.deepEqual(res[6], {
		stop_id: 's1',
		trip_id: 't4',
		service_id: 's1',
		route_id: 'r4',
		shape_id: undefined,
		start_of_trip: '2021-02-02',
		arrival: Date.parse('2021-02-02T16:00+01:00') / 1000,
		departure: Date.parse('2021-02-02T16:01+01:00') / 1000,
	})
	t.deepEqual(res[7], {
		stop_id: 's3b',
		trip_id: 't4',
		service_id: 's1',
		route_id: 'r4',
		shape_id: undefined,
		start_of_trip: '2021-02-02',
		arrival: Date.parse('2021-02-02T15:20+00:00') / 1000,
		departure: Date.parse('2021-02-02T15:21+00:00') / 1000,
	})
})

test('compute-sorted-connections', async (t) => {
	const sortedCons = await computeSortedConnections(readFile, 'Europe/Berlin')

	const from = 1552324800 // 2019-03-11T18:20:00+01:00
	const to = 1552377500 // 2019-03-12T08:58:20+01:00
	const fromI = sortedCons.findIndex(c => c.departure >= from)
	const toI = sortedCons.findIndex(c => c.departure > to)
	const connections = sortedCons.slice(fromI, toI)

	t.deepEqual(connections, [{
		tripId: 'b-outbound-on-working-days',
		serviceId: 'on-working-days',
		routeId: 'B',
		fromStop: 'lake',
		departure: 1552324920,
		toStop: 'airport',
		arrival: 1552325400,
		headwayBased: false
	}, {
		tripId: 'b-downtown-on-working-days',
		serviceId: 'on-working-days',
		routeId: 'B',
		fromStop: 'airport',
		departure: 1552377360,
		toStop: 'lake',
		arrival: 1552377720,
		headwayBased: false
	}])
})

test('compute-sorted-connections: handles timezones properly', async (t) => {
	const readFile = readFilesFromFixture('timezones')
	const cons = await computeSortedConnections(readFile, 'Europe/Berlin')

	t.deepEqual(cons, [{
		tripId: 't1',
		serviceId: 's1',
		routeId: 'r1',
		fromStop: 's1',
		departure: Date.parse('2021-02-02T04:01+01:00') / 1000,
		toStop: 's2',
		arrival: Date.parse('2021-02-02T04:20+01:00') / 1000,
		headwayBased: false,
	}, {
		tripId: 't2',
		serviceId: 's1',
		routeId: 'r2',
		fromStop: 's1',
		departure: Date.parse('2021-02-02T08:01+01:00') / 1000,
		toStop: 's3',
		arrival: Date.parse('2021-02-02T07:20+00:00') / 1000,
		headwayBased: false,
	}, {
		tripId: 't3',
		serviceId: 's1',
		routeId: 'r3',
		fromStop: 's1',
		departure: Date.parse('2021-02-02T12:01+01:00') / 1000,
		toStop: 's3a',
		arrival: Date.parse('2021-02-02T11:20+00:00') / 1000,
		headwayBased: false,
	}, {
		tripId: 't4',
		serviceId: 's1',
		routeId: 'r4',
		fromStop: 's1',
		departure: Date.parse('2021-02-02T16:01+01:00') / 1000,
		toStop: 's3b',
		arrival: Date.parse('2021-02-02T15:20+00:00') / 1000,
		headwayBased: false,
	}])
})

test('compute-service-breaks', async (t) => {
	const connections = await computeSortedConnections(readFile, 'Europe/Berlin')
	const allBreaks = computeServiceBreaks(connections, {
		minLength: 30 * 60, // 30m
	})

	const breaks = []
	const from = 1557309600 // 2019-05-08T12:00:00+02:00
	const to = 1557493200 // 2019-05-10T15:00:00+02:00
	for await (const br of allBreaks) {
		if (br.start < from || br.start > to) continue
		if (br.fromStop !== 'airport' || br.toStop !== 'lake') continue
		breaks.push(br)
	}

	t.deepEqual(breaks, [{
		fromStop: 'airport',
		toStop: 'lake',
		start: Date.parse('2019-05-08T13:14:00+02:00') / 1000,
		end: Date.parse('2019-05-09T08:56:00+02:00') / 1000,
		duration: 70920,
		routeId: 'B',
		serviceId: 'on-working-days',
	}, {
		fromStop: 'airport',
		toStop: 'lake',
		start: Date.parse('2019-05-09T08:56:00+02:00') / 1000,
		end: Date.parse('2019-05-09T13:14:00+02:00') / 1000,
		duration: 15480,
		routeId: 'B',
		serviceId: 'on-working-days',
	}, {
		fromStop: 'airport',
		toStop: 'lake',
		start: Date.parse('2019-05-09T13:14:00+02:00') / 1000,
		end: Date.parse('2019-05-10T08:56:00+02:00') / 1000,
		duration: 70920,
		routeId: 'B',
		serviceId: 'on-working-days',
	}, {
		fromStop: 'airport',
		toStop: 'lake',
		start: Date.parse('2019-05-10T08:56:00+02:00') / 1000,
		end: Date.parse('2019-05-10T13:14:00+02:00') / 1000,
		duration: 15480,
		routeId: 'B',
		serviceId: 'on-working-days',
	}, {
		fromStop: 'airport',
		toStop: 'lake',
		start: Date.parse('2019-05-10T13:14:00+02:00') / 1000,
		end: Date.parse('2019-05-11T08:56:00+02:00') / 1000,
		duration: 70920,
		routeId: 'B',
		serviceId: 'on-working-days',
	}])
})

test('extendedToBasic', (t) => {
	t.plan(2)
	t.equal(extendedToBasic(110), 0)
	t.equal(extendedToBasic(706), 3)
})

require('./read-pathways')
require('./read-shapes')
require('./build-trajectory')
require('./compute-trajectories')

test('optimise-services-and-exceptions: works', async (t) => {
	const readFile = readFilesFromFixture('optimise-services-and-exceptions')

	const optimisedServices = optimiseServicesAndExceptions(readFile, 'Europe/Berlin')
	const res = {}

	const baseSvc = {
		monday: '0',
		tuesday: '0',
		wednesday: '0',
		thursday: '0',
		friday: '0',
		saturday: '0',
		sunday: '0',
		start_date: '20220301', end_date: '20220410',
	}
	const expected = {
		'more-exceptions-than-regular': {
			changed: true,
			svc: {
				...baseSvc,
				service_id: 'more-exceptions-than-regular',
			},
			exceptions: [{
				service_id: 'more-exceptions-than-regular',
				date: '20220302',
				exception_type: '1',
			}, {
				service_id: 'more-exceptions-than-regular',
				date: '20220324',
				exception_type: '1',
			}, {
				service_id: 'more-exceptions-than-regular',
				date: '20220330',
				exception_type: '1',
			}, {
				service_id: 'more-exceptions-than-regular',
				date: '20220331',
				exception_type: '1',
			}],
		},
		'more-regular-than-exceptions': {
			changed: true,
			svc: {
				...baseSvc,
				service_id: 'more-regular-than-exceptions',
				monday: '1',
				friday: '1',
			},
			exceptions: [],
		},
		'should-stay-unchanged': {
			changed: false,
			svc: {
				...baseSvc,
				service_id: 'should-stay-unchanged',
				tuesday: '1',
				saturday: '1',
			},
			exceptions: [{
				service_id: 'should-stay-unchanged',
				date: '20220314',
				exception_type: '1',
			}],
		},
	}

	for await (const [id, changed, svc, exceptions] of optimisedServices) {
		t.deepEqual(expected[id].changed, changed, id + ': changed')
		t.deepEqual(expected[id].svc, svc, id + ': svc')
		t.deepEqual(expected[id].exceptions, exceptions, id + ': exceptions')
	}
})
