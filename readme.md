# gtfs-utils

**Utilities to process [GTFS](https://developers.google.com/transit/gtfs/) data sets.**

[![npm version](https://img.shields.io/npm/v/gtfs-utils.svg)](https://www.npmjs.com/package/gtfs-utils)
[![build status](https://api.travis-ci.org/public-transport/gtfs-utils.svg?branch=master)](https://travis-ci.org/public-transport/gtfs-utils)
![ISC-licensed](https://img.shields.io/github/license/public-transport/gtfs-utils.svg)
[![chat on gitter](https://badges.gitter.im/public-transport/Lobby.svg)](https://gitter.im/public-transport/Lobby)
[![support Jannis via GitHub Sponsors](https://img.shields.io/badge/support%20Jannis-donate-fa7664.svg)](https://github.com/sponsors/derhuerst)

- [`readCsv(path)`](#readcsvpath)
- [`readStops(readFile, filter)`](#readstopsreadfile-filter)
- [`readTrips(readFile, filter)`](#readtripsreadfile-filter)
- [`parseDate(dateStr, timezone)`](#parsedatedatestr-timezone)
- [`formatDate(t, timezone)`](#formatdatet-timezone)
- [`parseTime(timeStr)`](#parsetimetimestr)
- [`readServicesAndExceptions(readFile, timezone, filters)`](#readservicesandexceptionsreadfile-timezone-filters)
- [`computeStopoverTimes(readFile, filters, timezone)`](#computestopovertimesreadfile-filters-timezone)
- [`computeConnections(readFile, timezone, filter)`](#computeconnectionsreadfile-timezone-filter)
- [`computeSchedules(readFile, filters, [computeSignature])`](#computeschedulesreadfile-filters-computesignature)
- [`computeSortedConnections(readFile, filters, timezone)`](#computesortedconnectionsreadfile-filters-timezone)
- [`findAlternativeTrips(trips, services, schedules) => (fromId, tDep, toId, tArr)`](#findalternativetripstrips-services-schedules--fromid-tdep-toid-tarr)
- [`computeServiceBreaks(sortedConnections)`](#computeservicebreakssortedconnections)
- [`routeTypes`](#routetypes)


## Installing

```shell
npm install gtfs-utils
```


## Usage

### `readCsv(path)`

```js
const readCsv = require('gtfs-utils/read-csv')

readCsv('path-to-file.txt')
.on('error', console.error)
.on('data', console.log)
```

Returns a [readable stream](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_readable_streams) in [`objectMode`](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_object_mode).

`path` can also be a [readable stream](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_readable_streams) like [`process.stdin`](https://nodejs.org/api/process.html#process_process_stdin).

### `readStops(readFile, filters = {})`

```js
const readCsv = require('gtfs-utils/read-csv')
const readStops = require('gtfs-utils/read-stops')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

readStops(readFile, {
	stop: s => s.stop_id[0] === 'a',
})
.then(async (stops) => {
	for await (const stop of stops.values()) {
		console.log(stop)
		break
	}
})
```

```js
{
	stop_id: 'airport',
	stop_name: 'International Airport (ABC)',
	stop_lat: '52',
	stop_lon: '14',
	stop_code: '🛫',
	stop_desc: 'train station at the Internationl Airport (ABC)',
	stop_url: 'https://fta.example.org/stations/airport.html',
	location_type: '1',
	stop_timezone: 'Europe/Berlin',
	wheelchair_boardings: '1',
	parent_station: '',
	child_stops: ['airport-1', 'airport-2'],
}
```

Will read `stops.txt`, reduce it into a map `stop_id => stop`, and add platform IDs of a station as `station.platforms`. Returns a [store instance](#stores).

### `readTrips(readFile, filter)`

```js
const readCsv = require('gtfs-utils/read-csv')
const readTrips = require('gtfs-utils/read-trips')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

const filter = t => t.route_id === 'A'

readTrips(readFile, filter)
.then(async (trips) => {
	for await (const trip of trips.values()) {
		console.log(trip)
		break
	}
})
```

```js
{
	trip_id: 'a-downtown-all-day',
	route_id: 'A',
	service_id: 'all-day'
}
```

Will read `trips.txt` and reduce it into a map `tripId => trip`. Returns a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/promise).

### `readTrips(readFile, filters = {})`

```js
const readCsv = require('gtfs-utils/read-csv')
const readTrips = require('gtfs-utils/read-trips')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

const trips = readTrips(readFile, {
	trip: s => s.trip_id === '1234',
})
for await (const trip of trips) console.log(trip)
```

```js
{
	route_id: 'A',
	service_id: 'all-day',
	trip_id: 'a-downtown-all-day',
	trip_headsign: '',
	trip_short_name: '',
	direction_id: '',
	wheelchair_accessible: '',
	bikes_allowed: '',
}

```

`readTrips` is an [async generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of).

### `parseDate(dateStr, timezone)`

```js
const parseDate = require('gtfs-utils/parse-date')

parseDate('20190303', 'Europe/Berlin')
// 1551567600
```

- `dateStr` must be in the `YYYYMMDD` format, as specific in [GTFS](https://developers.google.com/transit/gtfs/).
- `timezone` must a timezone name from the [tz database](https://en.wikipedia.org/wiki/Tz_database#Names_of_time_zones).

### `formatDate(t, timezone)`

```js
const formatDate = require('gtfs-utils/format-date')

formatDate(1551567600, 'Europe/Berlin')
// '20190303'
```

- `t` must be a [Unix timestamp](https://en.wikipedia.org/wiki/Unix_time).
- `timezone` must a timezone name from the [tz database](https://en.wikipedia.org/wiki/Tz_database#Names_of_time_zones).

### `parseTime(timeStr)`

```js
const parseTime = require('gtfs-utils/parse-date')

parseTime('21:30')
// {hours: 21, minutes: 30, seconds: null}
parseTime('21:30:45')
// {hours: 21, minutes: 30, seconds: 45}
```

### `readServicesAndExceptions(readFile, timezone, filters)`

```js
const readCsv = require('gtfs-utils/read-csv')
const readServices = require('gtfs-utils/read-services-and-exceptions')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

const filters = {
	service: s => s.monday === '1',
	serviceException: e => e.exception_type === '2'
}

readServices(readFile, 'Europe/Berlin', filters)
.then(async (services) => {
	for await (const [id, days] of services) {
		console.log(id, days)
	}
})
.catch(console.error)
```

Will read `calendar.txt` and `calendar_dates.txt` and condense each service into the a list of days it is valid for. Returns a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/promise).

The result might look like this:

```
service-1 [
	1551394800,
	1551481200,
	1551567600,
	1551654000,
	…
]
service-2 [
	1551567600,
	1552690800,
	1555797600
]
…
```

*Note*: In order to work, `readServicesAndExceptions` will load (a reduced form of) `calendar.txt` and `calendar_dates.txt` into memory. This might fail with huge data sets.

### `computeStopoverTimes(readFile, filters, timezone)`

```js
const readCsv = require('gtfs-utils/read-csv')
const computeStopoverTimes = require('gtfs-utils/compute-stopover-times')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

const filters = {
	service: s => s.monday === '1',
	trip: t => t.route_id === 'A',
	stopover: s => s.stop_id === 'some-stop-id'
}
const stopovers = computeStopoverTimes(readFile, filters, 'Europe/Berlin')

stopovers
.on('error', console.error)
.on('data', console.log)
```

Returns a [readable stream](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_readable_streams) in [`objectMode`](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_object_mode).

- `readFile` must be a function that, when called with a file name, returns a [readable stream](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_readable_streams) in [`objectMode`](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_object_mode).
- `filters` must be an object; It may have the fields `service`, `trip`, `stopover`, each with a filter function.
- `timezone` must a timezone name from the [tz database](https://en.wikipedia.org/wiki/Tz_database#Names_of_time_zones).

A single item from the stream may look like this:

```js
{
	stop_id: 'airport',
	trip_id: 'b-downtown-on-working-days',
	service_id: 'on-working-days',
	route_id: 'B',
	sequence: '1',
	start_of_trip: 1563573600,
	arrival: 1557486780,
	departure: 1557486840
}
```

*Note*: In order to work, `computeStopoverTimes` must load all of `calendar.txt`, `calendar_dates.txt` and `trips.txt` into memory (not `stop_times.txt` however). This might fail with huge data sets.

### `computeConnections(readFile, timezone, filter)`

```js
const readCsv = require('gtfs-utils/read-csv')
const computeConnections = require('gtfs-utils/compute-connections')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

const filter = stopover => stopover.stop_id === 'some-stop-id'

computeConnections(readFile, 'Europe/Berlin', filter)
.then((connectionsByTrip) => {
	for (let connectionsOfTrip of connectionsByTrip) {
		for (let connection of connectionsOfTrip) {
			console.log(connection)
		}
		break
	}
})
.catch(console.error)
```

```js
{
	tripId: 'b-outbound-on-working-days',
	fromStop: 'center',
	departure: 65640,
	toStop: 'lake',
	arrival: 66000
}
```

Returns a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/promise) that will resolve with an [iterable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols).

*Note*: In order to work, `computeConnections` will load (a reduced form of) `stop_times.txt` into memory. This might fail with huge data sets.

### `computeSchedules(readFile, filters, [computeSignature])`

This utility computes what we call *schedules*, "patterns" by which vehicles visit stops. An example schedule:

```js
{
	id: '248tGP', // signature
	trips: [
		// The trip `a downtown-all-day-1` follows this schedule and starts
		// 55380 seconds after midnight on each day it runs.
		{tripId: 'a-downtown-all-day-1', start: 55380}
	],
	// Arrives at 0s at `airport`, departs 30s later.
	// Arrives at 420s at `museum`, departs 60s later.
	// Arrives at 720s at `center`, departs 90s later.
	stops: ['airport', 'museum', 'center'],
	arrivals: [0, 420, 720],
	departures: [30, 480, 810]
}
```

*Schedules* reduce the implicit complexity of GTFS data sets a lot, because one schedule summarizes many trips with a certain "pattern". Paired with [`readServicesAndExceptions`](#readservicesandexceptionsreadfile-timezone-filters), you can easily answer questions like *Which vehicles run from X to Y at T?* and *Which other vehicles run as well?*.

```js
const readCsv = require('gtfs-utils/read-csv')
const computeSchedules = require('gtfs-utils/compute-schedules')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

const filters = {
	service: s => s.monday === '1',
	serviceException: e => e.exception_type === '2'
}

computeSchedules(readFile, filters)
.then((schedules) => {
	const someScheduleId = Object.keys(schedules)[0]
	const someSchedule = schedules[someScheduleId]
	console.log(someSchedule)
})
.catch(console.error)
```

Will read `trips.txt` and `stop_times.txt` and compute schedules from it. Returns a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/promise).

- `readFile` must be a function that, when called with a file name, returns a [readable stream](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_readable_streams) in [`objectMode`](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_object_mode).
- `filters` must be an object; It may have the fields `trip` & `stopover`, each with a filter function.

*Note*: In order to work, `computeSchedules` will load (a reduced form of) `trips.txt` and `stop_times.txt` into memory. This might fail with huge data sets.

### `computeSortedConnections(readFile, filters, timezone)`

```js
const readCsv = require('gtfs-utils/read-csv')
const computeSortedConnections = require('gtfs-utils/compute-sorted-connections')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

computeSortedConnections(readFile, {}, 'Europe/Berlin')
.then((sortedConnections) => {
	const from = 1552324800 // UNIX timestamp
	const to = 1552393800 // UNIX timestamp
	const fromI = sortedConnections.findIndex(c => c.departure >= from)
	const endI = sortedConnections.findIndex(c => c.departure > to)
	for (let i = 0; i < endI; i++) {
		console.log(sortedConnections[i])
	}
})
.catch(console.error)
```

```js
{
	tripId: 'b-outbound-on-working-days',
	fromStop: 'lake',
	departure: 1552324920,
	toStop: 'airport',
	arrival: 1552325400,
	routeId: 'B',
	serviceId: 'on-working-days'
}
{
	tripId: 'b-downtown-on-working-days',
	fromStop: 'airport',
	departure: 1552392840,
	toStop: 'lake',
	arrival: 1552393200,
	routeId: 'B',
	serviceId: 'on-working-days'
}
```

Returns a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/promise) that will resolve with an array of connections.

*Note*: `computeSortedConnections` will load (reduced forms of) `trips.txt` and `stop_times.txt` into memory. This might fail with huge data sets.

- `readFile` must be a function that, when called with a file name, returns a [readable stream](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_readable_streams) in [`objectMode`](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_object_mode).
- `filters` must be an object; It may have the fields `service`, `trip` & `stopover`, each with a filter function.
- `timezone` must a timezone name from the [tz database](https://en.wikipedia.org/wiki/Tz_database#Names_of_time_zones).

### `findAlternativeTrips(trips, services, schedules) => (fromId, tDep, toId, tArr)`

```
           fromId  --time window-->  toId
departure at tDep                    arrival at tArr
```

For a time window `(tDep, tArr)` to get from stop `fromId` to stop `toId`, `findAlternativeTrips` will return a list of all trips that run from `fromId` to `toId` equally fast or faster.

`trips` must be in the format returned by `readTrips`, `services` in the format of `readServicesAndExceptions`, and `schedules` in the format of `computeSchedules`.

*Note*: The purpose of this function is to identify *direct* alternative trips to a given trip; It *is not* a replacement for a proper routing engine. (There might be a faster way from `fromId` to `toId` via transfer, and `findAlternativeTrips` won't return it.)

As an example, we're gonna use [`sample-gtfs-feed`](https://npmjs.com/package/sample-gtfs-feed):

```js
const readCsv = require('gtfs-utils/read-csv')
const readTrips = require('gtfs-utils/read-trips')
const readServices = require('gtfs-utils/read-services-and-exceptions')
const computeSchedules = require('gtfs-utils/compute-schedules')
const createFindAlternativeTrips = require('gtfs-utils/find-alternative-trips')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

const timezone = 'Europe/Berlin'
const noFilter = () => true
const noFilters = {}

// prerequisites
Promise.all([
	readTrips(readFile, noFilter),
	readServices(readFile, timezone, noFilters),
	computeSchedules(readFile, noFilters)
])
.then(([trips, services, schedules]) => {
	const findAltTrips = createFindAlternativeTrips(trips, services, schedules)

	// travel times of a downtown trip of the A line
	const fromId = 'airport'
	const tDep = new Date('2019-03-05T15:24:00+01:00') / 1000
	const toId = 'center'
	const tArr = new Date('2019-03-05T15:35:00+01:00') / 1000

	// find an alternative trip of the C line
	console.log(findAltTrips(fromId, tDep, toId, tArr))
})
.catch(console.error)
```

```js
[ { // This is the trip we were using as query.
	tripId: 'a-downtown-all-day',
	routeId: 'A',
	serviceId: 'all-day',
	departure: 1551795840, // 2019-03-05T15:24:00+01:00
	arrival: 1551796500 // 2019-03-05T15:35:00+01:00
}, { // This is an alternative trip.
	tripId: 'c-downtown-all-day',
	routeId: 'C',
	serviceId: 'all-day',
	departure: 1551796080, // 2019-03-05T15:28:00+01:00
	arrival: 1551796380 // 2019-03-05T15:33:00+01:00
} ]
```

### `computeServiceBreaks(sortedConnections)`

Most public transport networks don't run 24/7, but instead have regular scheduled "service breaks", e.g. at night or on Sundays.

Given [sorted connections](#computesortedconnectionsreadfile-filters-timezone), `computeServiceBreaks` finds periods of time without service between two stations.

It depends on the specific network what period of time can be considered a "break": In a large city, it could be no bus/train running from 2am to 3am; In a small town there might only be bus/train every hour, with a break of 8 hours at night. This is why `computeServiceBreaks` optionally takes a second parameter `minLength` in seconds.

```js
const readCsv = require('gtfs-utils/read-csv')
const computeSortedConnections = require('gtfs-utils/compute-sorted-connections')
const computeServiceBreaks = require('gtfs-utils/compute-service-breaks')

const serviceBreakMinLength = 30 * 60 // 30 minutes
const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

computeSortedConnections(readFile, {}, 'Europe/Berlin')
.then((connections) => {
	const {findBetween} = computeServiceBreaks(connections, serviceBreakMinLength)
	const start = '2019-05-08T12:00:00Z'
	const end = '2019-05-10T15:00:00Z'
	console.log(findBetween('airport', 'center', start, end))
})
.catch(console.error)
```

### `routeTypes`

```js
const routeTypes = require('gtfs-utils/route-types')

console.log(routeTypes.basic.find(type => type.gtfs === 3))
// { gtfs: 3, fptf: 'bus' }
```

`fptf` contains the [*Friendly Public Transport Format (FPTF)* mode](https://github.com/public-transport/friendly-public-transport-format/tree/1.2.1/spec#modes).


## Related

- [gtfs-stream](https://github.com/staeco/gtfs-stream) – Streaming GTFS and GTFS-RT parser for node
- [mapzen-gtfs](https://github.com/transitland/mapzen-gtfs) – Python library for reading and writing GTFS feeds. (Python)


## Contributing

If you have a question or have difficulties using `gtfs-utils`, please double-check your code and setup first. If you think you have found a bug or want to propose a feature, refer to [the issues page](https://github.com/public-transport/gtfs-utils/issues).
