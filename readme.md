# gtfs-utils

**Utilities to process [GTFS](https://developers.google.com/transit/gtfs/) data sets.**

[![npm version](https://img.shields.io/npm/v/gtfs-utils.svg)](https://www.npmjs.com/package/gtfs-utils)
[![build status](https://api.travis-ci.org/public-transport/gtfs-utils.svg?branch=master)](https://travis-ci.org/public-transport/gtfs-utils)
![ISC-licensed](https://img.shields.io/github/license/public-transport/gtfs-utils.svg)
[![chat on gitter](https://badges.gitter.im/public-transport/Lobby.svg)](https://gitter.im/public-transport/Lobby)


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

Returns a [readable stream](https://nodejs.org/api/stream.html#stream_readable_streams) in [`objectMode`](https://nodejs.org/api/stream.html#stream_object_mode).

### `readTrips(readFile, filter)`

```js
const readCsv = require('gtfs-utils/read-csv')
const readTrips = require('gtfs-utils/read-trips')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

const filter = t => t.route_id === 'A'

readTrips(readFile, filter)
.then((trips) => {
	const someTrip = trips[Object.keys(trips)[0]]
	console.log(someTrip)
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

### `parseDate(dateStr, timezone)`

```js
const parseDate = require('gtfs-utils/parse-date')

parseDate('20190303', 'Europe/Berlin')
// 1551567600
```

- `dateStr` must be in the `YYYYMMDD` format, as specific in [GTFS](https://developers.google.com/transit/gtfs/).
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
.then(console.log)
.catch(console.error)
```

Will read `calendar.txt` and `calendar_dates.txt` and condense each service into the a list of days it is valid for. Returns a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/promise).

The result might look like this:

```js
{
	'service-1': [
		1551394800,
		1551481200,
		1551567600,
		1551654000
		// …
	],
	'service-2': [
		1551567600,
		1552690800,
		1555797600
	]
	// …
}
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

Returns a [readable stream](https://nodejs.org/api/stream.html#stream_readable_streams) in [`objectMode`](https://nodejs.org/api/stream.html#stream_object_mode).

- `readFile` must be a function that, when called with a file name, returns a [readable stream](https://nodejs.org/api/stream.html#stream_readable_streams) in [`objectMode`](https://nodejs.org/api/stream.html#stream_object_mode).
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
.then((connectionSets) => {
	for (let connections of connectionSets) {
		for (let connection of connections) {
			console.log(connection)
		}
		break
	}
})
.catch(console.error)
```

```js
{
	trip_Id: 'b-outbound-on-working-days',
	from_stop: 'center',
	to_stop: 'lake',
	departure: 65640,
	arrival: 66000
}
```

Returns a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/promise) that will resolve with an [iterable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols).

*Note*: In order to work, `computeConnections` will load (a reduced form of) `stop_times.txt` into memory. This might fail with huge data sets.

### `computeSchedules(readFile, filters, [computeSignature])`

This utility computes what we called *schedules*, "patterns" by which vehicles visit stops. An example schedule:

```js
{
	id: '248tGP', // signature
	trips: [
		// The trip `a downtown-all-day` follows this schedule and starts
		// 55380 seconds after midnight on each day it runs.
		{tripId: 'a-downtown-all-day', start: 55380}
	],
	// Arrives at 0s at `airport`, departs 30s later.
	// Arrives at 420s at `museum`, departs 60s later.
	// Arrives at 720s at `center`, departs 90s later.
	stops: ['airport', 'museum', 'center'],
	arrivals: [0, 420, 720],
	departures: [30, 480, 810]
}
```

*Schedules* reduce the implicit complexity of GTFS data sets a lot, because a schedule will contain *every* trip with its "pattern". Paired with [`readServicesAndExceptions`](#readservicesandexceptionsreadfile-timezone-filters), you can easily answer questions like *Which vehicles run from X to Y at T?* and *Which other vehicles run as well?*.

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
	const someSchedule = schedules[Object.keys(schedules)[0]]
	console.log(someSchedule)
})
.catch(console.error)
```

Will read `trips.txt` and `stop_times.txt` and compute schedules from it. Returns a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/promise).

*Note*: In order to work, `computeSchedules` will load (a reduced form of) `trips.txt` and `stop_times.txt` into memory. This might fail with huge data sets.

### `computeSortedConnections(readFile, filters, timezone)`

Returns a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/promise) that will resolve with an [`avl` tree](https://www.npmjs.com/package/avl#api) of connections.

*Note*: `computeSortedConnections` will load (reduced forms of) `trips.txt` and `stop_times.txt` into memory. This might fail with huge data sets.

```js
const readCsv = require('gtfs-utils/read-csv')
const computeSortedConnections = require('gtfs-utils/compute-sorted-connections')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

computeSortedConnections(readFile, {}, 'Europe/Berlin')
.then((sortedConnections) => {
	const from = 1552324800 // UNIX timestamp
	const to = 1552393800 // UNIX timestamp
	sortedConnections.range(from, to, node => {
		console.log(node.data)
		return false // continue walking the build
	})
})
.catch(console.error)
```

```js
{
	fromStop: 'lake',
	departure: 1552324920,
	toStop: 'airport',
	arrival: 1552325400,
	routeId: 'B',
	serviceId: 'on-working-days'
}
{
	fromStop: 'airport',
	departure: 1552392840,
	toStop: 'lake',
	arrival: 1552393200,
	routeId: 'B',
	serviceId: 'on-working-days'
}
```


## Contributing

If you have a question or have difficulties using `gtfs-utils`, please double-check your code and setup first. If you think you have found a bug or want to propose a feature, refer to [the issues page](https://github.com/public-transport/gtfs-utils/issues).
