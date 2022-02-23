# gtfs-utils API

- [store API](#store-api)
- [`readCsv(path)`](#readcsv)
- [`readStops(readFile, filter)`](#readstops)
- [`readTrips(readFile, filter)`](#readtrips)
- [`parseDate(dateStr, timezone)`](#parsedate)
- [`formatDate(t, timezone)`](#formatdate)
- [`parseTime(timeStr)`](#parsetime)
- [`routeTypes`](#routetypes)
- [`readServicesAndExceptions(readFile, timezone, filters)`](#readservicesandexceptions)
- [`computeConnections(readFile, timezone, filter)`](#computeconnections)
- [`computeSchedules(readFile, filters, [computeSignature])`](#computeschedules)
- [`computeSortedConnections(readFile, filters, timezone)`](#computesortedconnections)
- [`findAlternativeTrips(trips, services, schedules) => (fromId, tDep, toId, tArr)`](#findalternativetrips)
- [`computeServiceBreaks(sortedConnections)`](#computeservicebreakssortedconnections)
- [`computeStopovers(readFile, timezone, filters)`](#computestopovers)
- [`readPathways(readFile, filters)`](#readpathways)
- [`readShapes(readFile, filters)`](#readshapes)
- [`computeTrajectories(readFile, filters)`](#computetrajectories)
- [`optimiseServicesAndExceptions(readFile, timezone, filters)`](#optimiseservicesandexceptions)


## `readCsv`

```js
const readCsv = require('gtfs-utils/read-csv')

readCsv('path-to-file.txt')
.on('error', console.error)
.on('data', row => console.log(row))
// or
for await (const row of await readCsv('path-to-file.txt')) {
	console.log(row)
}
```

`readCsv(path)` is an async function that returns a [readable stream](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_readable_streams) in [`objectMode`](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_object_mode).

`path` can also be a [readable stream](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_readable_streams) like [`process.stdin`](https://nodejs.org/api/process.html#process_process_stdin).


## `readStops`

```js
const readCsv = require('gtfs-utils/read-csv')
const readStops = require('gtfs-utils/read-stops')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

const stops = await readStops(readFile, {
	stop: s => s.stop_id[0] === 'a',
})
for await (const stop of stops.values()) {
	console.log(stop)
	break
}
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
	wheelchair_boarding: '1',
	parent_station: '',
	level_id: '',
	platform_code: '',
	stops: ['airport-1', 'airport-2'],
	entrances: ['airport-entrance'],
	boardingAreas: [],
}
```

`readStops(readFile, filters = {}, opt = {})`

1. reads `stops.txt` into a [store](#store-api) `stop_id => stop`,
2. adds stop IDs of a station as `station.stop`,
3. adds entrance IDs of a stop as `stop.entrances`,
4. adds boarding area IDs of a stop as `stop.boardingAreas`.


## `readTrips`

```js
const readCsv = require('gtfs-utils/read-csv')
const readTrips = require('gtfs-utils/read-trips')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

const trips = await readTrips(readFile, {
	trip: t => t.route_id === 'A',
})
for await (const trip of trips.values()) {
	console.log(trip)
	break
}
```

```js
{
	trip_id: 'a-downtown-all-day',
	route_id: 'A',
	service_id: 'all-day'
}
```

`readTrips(readFile, filters = {}, opt = {})` reads `trips.txt` and reduces it into a map `tripId => trip`. Returns a [store](#store-api).


## `parseDate`

```js
const parseDate = require('gtfs-utils/parse-date')

parseDate('20190303', 'Europe/Berlin')
// 1551567600
```

`parseDate(dateStr, timezone)` parses a GTFS Date value.

- `dateStr` must be in the `YYYYMMDD` format, as specific in [GTFS](https://developers.google.com/transit/gtfs/).
- `timezone` must a timezone name from the [tz database](https://en.wikipedia.org/wiki/Tz_database#Names_of_time_zones).


## `formatDate(t, timezone)`

```js
const formatDate = require('gtfs-utils/format-date')

formatDate(1551567600, 'Europe/Berlin')
// '20190303'
```

`formatDate(t, timezone)` formats a timestamp as a GTFS Date value.

- `t` must be a [Unix timestamp](https://en.wikipedia.org/wiki/Unix_time).
- `timezone` must a timezone name from the [tz database](https://en.wikipedia.org/wiki/Tz_database#Names_of_time_zones).


## `parseTime`

```js
const parseTime = require('gtfs-utils/parse-date')

parseTime('21:30')
// {hours: 21, minutes: 30, seconds: null}
parseTime('21:30:45')
// {hours: 21, minutes: 30, seconds: 45}
```

`parseTime(timeStr)` parses a GTFS Time value.


## `routeTypes`

```js
const routeTypes = require('gtfs-utils/route-types')

console.log(routeTypes.basic.find(type => type.gtfs === 3))
// { gtfs: 3, fptf: 'bus' }
```

`fptf` contains the [*Friendly Public Transport Format (FPTF)* mode](https://github.com/public-transport/friendly-public-transport-format/tree/1.2.1/spec#modes).


## `pickupTypes`

```js
const pickupTypes = require('gtfs-utils/pickup-types')
console.log(pickupTypes.MUST_PHONE_AGENCY) // 2
```

Contains all possible values of the `pickup_type` field in [`stop_times.txt`](https://gtfs.org/reference/static/#stop_timestxt).


## `dropOffTypes`

```js
const dropOffTypes = require('gtfs-utils/drop-off-types')
console.log(dropOffTypes.MUST_COORDINATE_WITH_DRIVER) // 3
```

Contains all possible values of the `drop_off_type` field in [`stop_times.txt`](https://gtfs.org/reference/static/#stop_timestxt).


## `bookingTypes`

```js
const bookingTypes = require('gtfs-utils/booking-types')
console.log(bookingTypes.SAME_DAY) // 1
```

Contains all possible values of the `booking_type` field in [`booking_rules.txt` of the GTFS-BookingRules extension (from GTFS-Flex)](https://github.com/MobilityData/gtfs-flex/blob/e1832cfea5ddb9df29bd2fc50e80b0a4987695c1/spec/reference.md#booking_rulestxt-file-added).


## `readServicesAndExceptions`

```js
const readCsv = require('gtfs-utils/read-csv')
const readServices = require('gtfs-utils/read-services-and-exceptions')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

const filters = {
	service: s => s.monday === '1',
	serviceException: e => e.exception_type === '2'
}

const services = readServices(readFile, 'Europe/Berlin', filters)
for await (const [id, days, svc] of services) console.log(id, days, svc)
```

`readServicesAndExceptions(readFile, timezone, filters = {})` reads `calendar.txt` and `calendar_dates.txt` and condenses each service into the a list of days it is valid for. Returns an [async iterable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/asyncIterator) of `[serviceId, daysOfOperation]` entries.

The code above will print the following:

```js
service-1 [
	1551394800,
	1551481200,
	1551567600,
	1551654000,
	// …
] {
	service_id: 'service-1',
	start_date: '20190301',
	end_date: '20190531',
	monday: '1',
	tuesday: '1',
	wednesday: '0',
	thursday: '0',
	friday: '1',
	saturday: '1',
	sunday: '1',
}
service-2 [
	1551567600,
	1552690800,
	1555797600
] {
	service_id: 'service-1',
	start_date: '20190227',
	end_date: '20190510',
	monday: '0',
	// …
}
// …
```

*Note:* Be careful when filtering services by day of the week! Time values in `stop_times.txt` can be >24h, so the day in `calendar.txt` does not necessarily indicate the day of every stopover.


## `computeConnections`

```js
const readCsv = require('gtfs-utils/read-csv')
const computeConnections = require('gtfs-utils/compute-connections')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

const connectionsByTrip = computeConnections(readFile, {
	stopTime: s => s.stop_id === 'some-stop-id',
})
for await (const connectionsOfTrip of connectionsByTrip) {
	for (const connection of connectionsOfTrip) console.log(connection)
	break
}
```

```js

{
	tripId: 'a-downtown-all-day',
	fromStop: 'airport',
	// .departure and .arrival are *not* "wall clock times", but seconds since
	// noon minus 12 hours!
	// see https://gist.github.com/derhuerst/574edc94981a21ef0ce90713f1cff7f6)
	departure: 55440, // 15h, 24m
	toStop: 'museum',
	arrival: 55800, // 15h, 30m
}
{
	tripId: 'a-downtown-all-day',
	fromStop: 'museum',
	departure: 55860, // 15h, 31m
	toStop: 'center',
	arrival: 56100, // 15h, 35m
}
```

A "connection" is a pair of `stop_time`s. `computeConnections(readFile, filters = {})` iterates over `stop_times.txt` and `frequencies.txt`, and emits all connections in the whole dataset. It returns an [async iterable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/asyncIterator).


## `computeSchedules`

This utility computes what we call "schedules", temporal patterns by which vehicles visit stops. An example schedule:

```js
{
	id: '248tGP', // signature, just a hash of the schedule's data
	trips: [
		// The trip `a downtown-all-day-1` follows this schedule and starts
		// 55380 seconds after `noon - 12h` on each day it runs.
		{tripId: 'a-downtown-all-day-1', start: 55380}
	],
	// Arrives at `airport` after 0s, departs 30s later.
	// Arrives at `museum` after 420s, departs 60s later.
	// Arrives at `center` after 720s, departs 90s later.
	stops: ['airport', 'museum', 'center'],
	arrivals: [0, 420, 720],
	departures: [30, 480, 810],
}
```

In schedule-based public transport systems, schedules reduce the implicit complexity of GTFS data sets a lot, because one schedule summarizes many trips with a certain "pattern". Paired with [`readServicesAndExceptions`](#readservicesandexceptions), you can easily answer questions like *Which vehicles run from X to Y at T?* and *Which other vehicles run as well?*.

```js
const readCsv = require('gtfs-utils/read-csv')
const computeSchedules = require('gtfs-utils/compute-schedules')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

const schedules = await computeSchedules(readFile)
for await (const schedule of schedules.values()) {
	console.log(schedule)
}
```

`computeSchedules(readFile, filters = {}, opt = {})` reads `trips.txt` and `stop_times.txt` and computes schedules from it. Returns a [store](#store-api).

- `readFile` must be a function that, when called with a file name, returns a [readable stream](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_readable_streams) in [`objectMode`](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_object_mode).
- `filters` must be an object; It may have the fields `trip`, `stopTime` & `frequencies`, each with a filter function.
- `opt` must be an object; It may optionally have a custom `computeSig` function that, given a schedule, computes a signature of it.

*Note:* In order to work, it must load (a reduced form of) `trips.txt`, `stop_times.txt` and `frequencies.txt` into memory. See [*store API*](#store-api) for more details.


## `computeStopovers`

```js
const readCsv = require('gtfs-utils/read-csv')
const computeStopovers = require('gtfs-utils/compute-stopovers')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

const stopovers = computeStopovers(readFile, 'Europe/Berlin', {
	trip: t => t.route_id === 'A',
	stopTime: s => s.stop_id === 'some-stop-id',
})

for await (const stopover of stopovers) {
	console.log(stopover)
}
```

`computeStopovers(readFile, timezone, filters = {})` reads *per-day* stop times from `trips.txt`, `stop_times.txt` and `frequencies.txt`, and applies them to the days of operation returned by [`readServicesAndExceptions(readFile, timezone, filters)`](#readservicesandexceptions), in order to compute *absolute* stop times.

- `readFile` must be a function that, when called with a file name, returns a [readable stream](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_readable_streams) in [`objectMode`](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_object_mode).
- `timezone` must a timezone name from the [tz database](https://en.wikipedia.org/wiki/Tz_database#Names_of_time_zones).
- `filters` must be an object; It may have the fields `trip`, `service`, `serviceException`, `stopTime`, `frequencies`, each with a filter function.

Returns an [async iterable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/asyncIterator) of `{stop_id, trip_id, service_id, route_id, start_of_trip, arrival, departure}` entries.

The code above will print the following:

```js
{
	stop_id: 'airport',
	trip_id: 'a-downtown-all-day',
	service_id: 'all-day',
	route_id: 'A',
	shape_id: 'a-downtown-all-day-s0',
	start_of_trip: 1551394800, // 2019-03-01T00:00:00+01:00
	arrival: 1551450180, // 2019-03-01T15:23:00+01:00
	departure: 1551450240, // 2019-03-01T15:24:00+01:00
	// Items have this additional entry if they're based on an exact_times=0
	// entry in frequencies.txt. See https://gtfs.org/reference/static/#frequenciestxt
	// headwayBased: true,
}
{
	stop_id: 'museum',
	trip_id: 'a-downtown-all-day',
	service_id: 'all-day',
	route_id: 'A',
	shape_id: 'a-downtown-all-day-s0',
	start_of_trip: 1551394800, // 2019-03-01T00:00:00+01:00
	arrival: 1551450600, // 2019-03-01T15:30:00+01:00
	departure: 1551450660, // 2019-03-01T15:31:00+01:00
}
// …
```

*Note:* In order to work, it must load reduced forms of `trips.txt`, `calendar.txt` and `calendar_dates.txt` into memory. See [*store API*](#store-api) for more details.


## `computeSortedConnections`

```js
const readCsv = require('gtfs-utils/read-csv')
const computeSortedConnections = require('gtfs-utils/compute-sorted-connections')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

const sortedConnections = await computeSortedConnections(readFile, 'Europe/Berlin')
const from = 1552324800 // UNIX timestamp
const to = 1552393800 // UNIX timestamp
const fromI = sortedConnections.findIndex(c => c.departure >= from)
const endI = sortedConnections.findIndex(c => c.departure > to)
for (let i = 0; i < endI; i++) {
	console.log(sortedConnections[i])
}
```

```js
{
	tripId: 'b-outbound-on-working-days',
	fromStop: 'lake',
	departure: 1552324920, // 2019-03-11T18:22:00+01:00
	toStop: 'airport',
	arrival: 1552325400, // 2019-03-11T18:30:00+01:00
	routeId: 'B',
	serviceId: 'on-working-days',
}
{
	tripId: 'b-downtown-on-working-days',
	fromStop: 'airport',
	departure: 1552392840, // 2019-03-12T13:14:00+01:00
	toStop: 'lake',
	arrival: 1552393200, // 2019-03-12T13:20:00+01:00
	routeId: 'B',
	serviceId: 'on-working-days',
}
```

`computeSortedConnections(readFile, timezone, filters = {})` reads all [connections](#computeConnections) and applies each to the respective [service](#readservicesandexceptions), to compute all *absolute-time* connections in the dataset. Returns a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/promise) that will resolve with an array of connections.

- `readFile` must be a function that, when called with a file name, returns a [readable stream](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_readable_streams) in [`objectMode`](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_object_mode).
- `timezone` must a timezone name from the [tz database](https://en.wikipedia.org/wiki/Tz_database#Names_of_time_zones).
- `filters` must be an object; It may have the fields `service`, `trip` & `stopover`, each with a filter function.

*Note:* `computeSortedConnections` must load (reduced forms of) `trips.txt`, `stop_times.txt` and `frequencies.txt` into memory. See [*store API*](#store-api) for more details.


## `findAlternativeTrips`

```
           fromId  --time window-->  toId
departure at tDep                    arrival at tArr
```

For a time window `(tDep, tArr)` to get from stop `fromId` to stop `toId`, `findAlternativeTrips` will return a list of all trips that run from `fromId` to `toId` equally fast or faster.

```js
// signature:
async findAlternativeTrips(readFile, timezone, services, schedules) => async function* findAltTrips(fromId, tDep, toId, tArr) {}
```

`services` must be a [store](docs/api#store-api) with a `serviceId => daysOfOperation` mapping. `schedules` must be in the format returned by `computeSchedules`.

*Note:* The purpose of this function is to identify *direct* alternative trips to a given trip; **It *is not* a replacement for a proper routing engine.** (There might be a faster way from `fromId` to `toId` via transfer, and `findAlternativeTrips` won't return it.)

As an example, we're gonna use [`sample-gtfs-feed`](https://npmjs.com/package/sample-gtfs-feed):

```js
const readCsv = require('gtfs-utils/read-csv')
const inMemoryStore = require('gtfs-utils/lib/in-memory-store')
const readServices = require('gtfs-utils/read-services-and-exceptions')
const computeSchedules = require('gtfs-utils/compute-schedules')
const findAlternativeTrips = require('gtfs-utils/find-alternative-trips')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')
const timezone = 'Europe/Berlin'

// read services into in-memory store
const services = inMemoryStore()
for await (const [id, svc] of readServices(readFile, timezone)) {
	await services.set(id, svc)
}

// read schedules
const schedules = await computeSchedules(readFile)

// travel times of a downtown trip of the A line
const fromId = 'airport'
const departure = 1551795840 // 2019-03-05T15:24:00+01:00
const toId = 'center'
const arrival = 1551796500 // 2019-03-05T15:35:00+01:00

// find an alternative trip of the C line
const findAltTrips = await findAlternativeTrips(
	readFile,
	timezone,
	services,
	schedules,
)
const altTrips = findAltTrips(fromId, departure, toId, arrival)
for await (const alt of altTrips) console.log(alt)
```

```js
{ // This is the trip we were using as query.
	tripId: 'a-downtown-all-day',
	routeId: 'A',
	serviceId: 'all-day',
	departure: 1551795840, // 2019-03-05T15:24:00+01:00
	arrival: 1551796500, // 2019-03-05T15:35:00+01:00
}
{ // This is an alternative trip.
	tripId: 'c-downtown-all-day',
	routeId: 'C',
	serviceId: 'all-day',
	departure: 1551796080, // 2019-03-05T15:28:00+01:00
	arrival: 1551796380, // 2019-03-05T15:33:00+01:00
}
```


## `computeServiceBreaks`

Most public transport networks don't run 24/7, but instead have regular scheduled "service breaks", e.g. at night or on Sundays.

Given [sorted connections](#computesortedconnections), `computeServiceBreaks(sortedConnections, opt = {})` finds periods of time without service between two stations.

It depends on the specific network what period of time can be considered a "break": In a large city, it could be no bus/train running from 2am to 3am; In a small town there might only be a bus/train every hour, with a break of 8 hours at night. You can pass a custom `opt.minLength` value in seconds.

```js
const readCsv = require('gtfs-utils/read-csv')
const computeSortedConnections = require('gtfs-utils/compute-sorted-connections')
const computeServiceBreaks = require('gtfs-utils/compute-service-breaks')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

let connections = await computeSortedConnections(readFile, 'Europe/Berlin')

// select time frame
const start = 1557313200 // 2019-05-08T12:00:00+01:00
const startI = connections.findIndex(c => c.departure >= start)
const end = 1557496800 // 2019-05-10T15:00:00+01:00
const endI = connections.findIndex(c => c.departure > end)
connections = connections.slice(startI, endI)

const serviceBreaks = computeServiceBreaks(connections, {
	minLength: 30 * 60, // 30 minutes
})
for await (const serviceBreak of serviceBreaks) {
	console.log(serviceBreak)
}
```


## store API

Some of the tools above need to read data into a [map](https://en.wikipedia.org/wiki/Associative_array) in order to work with it. In memory-constrained environments (such as [FaaS](https://en.wikipedia.org/wiki/Function_as_a_service)es), the amount of data to be read might be bigger than the available memory; This is why **`gtfs-utils` allows you to pass in your own store implementation**.

In this case you could pass in a [Redis](https://redis.io)-backed store instead:

```js
const createRedisStore = require('gtfs-utils/lib/redis-store')

computeSchedules(readFile, filters, {
	// let computeSchedules use a Redis-backed store
	createStore: createRedisStore,
})
```

These stores are available:

- `gtfs-utils/lib/in-memory-store` – stores data in memory; used by default
- `gtfs-utils/lib/redis-store` – stores data in [Redis](https://redis.io)

## `readPathways`

```js
const readCsv = require('gtfs-utils/read-csv')
const readPathways = require('gtfs-utils/read-pathways')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

const pathways = readPathways(readFile)
for await (const [stationId, node, allNodes] of pathways) {
	console.log(stationId, node)
}
```

`readPathways(readFile, filters = {}, opt = {})` reads all pathways into memory, reads all pathways of a station into a [directed graph](https://en.wikipedia.org/wiki/Directed_graph). Each node of this graph has two fields `id` and `connectedTo`:

```js
{ // node `stop-123`
	id: 'stop-123',
	connectedTo: {
		'stop-321': [
			{ // pathway connecting `stop-123` to `stop-321`
				pathway_id: 'pw-1234',
				from_stop_id: 'stop-123',
				to_stop_id: 'stop-321',
				pathway_mode: '4',
			},
			{ // node `stop-321`
				id: 'stop-321',
				connectedTo: {
					// …
				},
			},
			// …
		],
	},
}
```

`readPathways` returns an [async iterable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/asyncIterator) of `[stationId, node, allNodesById]` triple.

- For each station, it will only emit *one* triple, with `node` being the first pathway (that is connected to this station) that it came across.
- `allNodesById` as an object, with all nodes of the graph stored by their IDs.

## `readShapes`

```js
const readCsv = require('gtfs-utils/read-csv')
const readShapes = require('gtfs-utils/read-shapes')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

const shapes = readShapes(readFile)
for await (const [shapeId, points] of shapes) {
	console.log(shapeId, points)
}
```

`readShapes(readFile, filters = {})` reads all shapes from `shapes.txt`. It returns an [async iterable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/asyncIterator) of `[stationId, points]` pairs, with `points` looking like this:

```js
[
	{
		shape_pt_lat: 48.59430,
		shape_pt_lon: 8.86477,
		shape_pt_sequence: 1,
		shape_dist_traveled: 0,
	}, {
		shape_pt_lat: 48.59394,
		shape_pt_lon: 8.86377,
		shape_pt_sequence: 3,
		shape_dist_traveled: 83.98,
	},
	// …
	{
		shape_pt_lat: 48.59431,
		shape_pt_lon: 8.86476,
		shape_pt_sequence: 82,
		shape_dist_traveled: 3112.71,
	}
]
```


## `computeTrajectories`

```js
const readCsv = require('gtfs-utils/read-csv')
const computeTrajectories = require('gtfs-utils/compute-trajectories')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

for await (const trajectory of computeTrajectories(readFile)) {
	console.log(trajectory)
}
```

`computeTrajectories(readFile, filters = {})` reads *per-day* stop times from `trips.txt`, `stop_times.txt` and `frequencies.txt`, and applies them to the days of operation returned by [`readServicesAndExceptions(readFile, timezone, filters)`](#readservicesandexceptions), in order to compute *absolute* stop times.

- `readFile` must be a function that, when called with a file name, returns a [readable stream](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_readable_streams) in [`objectMode`](https://nodejs.org/docs/latest-v10.x/api/stream.html#stream_object_mode).
- `filters` must be an object; It may have the fields `trip`, `service`, `serviceException`, `stopTime`, `frequencies`, each with a filter function.

Returns an [async iterable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/asyncIterator) of trajectories; Each trajectory is a [GeoJSON](https://geojson.org) [`LineString`](https://datatracker.ietf.org/doc/html/rfc7946#section-3.1.4), with additional items in each coordinate:

1. longitude
2. latitude
3. altitude
4. arrival time
5. departure time

As an example, we're gonna use [`sample-gtfs-feed`](https://npmjs.com/package/sample-gtfs-feed):

```js
const readCsv = require('gtfs-utils/read-csv')
const computeTrajectories = require('gtfs-utils/compute-trajectories')

const readFile = async (name) => {
	const path = require.resolve('sample-gtfs-feed/gtfs/' + name + '.txt')
	return await readCsv(path)
}

const filters = {
	trip: t => t.route_id === 'A',
}

for await (const trajectory of computeTrajectories(readFile, filters)) {
	console.log(trajectory)
}
```

```js
{
	type: 'Feature',
	properties: {
		id: 'ZGB8W9-a-downtown-all-day-s0',
		scheduleId: 'Z2gvHvF',
		shapeId: 'a-downtown-all-day-s0',
		tripId: 'a-downtown-all-day',
		serviceId: 'all-day',
	},
	geometry: {
		type: 'LineString',
		coordinates: [
			[13.510294914, 52.364833832, null, 61, 61],
			[13.510567665, 52.364398956, null, 63, 63],
			[13.510860443, 52.363952637, null, 64, 64],
			// …
			[13.452836037, 52.44562149, null, 387, 387],
			[13.451435089, 52.445671082, null, 390, 390],
			[13.449950218, 52.445732117, null, 392, 392],
			// …
			[13.495876312, 52.500293732, null, 713, 713],
			[13.496304512, 52.500156403, null, 714, 714],
			[13.497889519, 52.499641418, null, 717, 717],
		],
	},
}
{
	type: 'Feature',
	properties: {
		id: 'R8lSc-a-outbound-all-day-s0',
		scheduleId: 'Z1bgqY0',
		shapeId: 'a-outbound-all-day-s0',
		tripId: 'a-outbound-all-day',
		serviceId: 'all-day',
	},
	geometry: {
		type: 'LineString',
		coordinates: [
			[13.497889519, 52.499641418, null, 65, 65],
			[13.496304512, 52.500156403, null, 69, 69],
			[13.495876312, 52.500293732, null, 70, 70],
			[13.495686531, 52.500354767, null, 71, 71],
			[13.495450974, 52.500431061, null, 71, 71],
			// …
			[13.465647697, 52.49892807, null, 153, 153],
			[13.465513229, 52.498714447, null, 154, 154],
			// …
			[13.509624481, 52.366386414, null, 720, 720],
			[13.509587288, 52.366352081, null, 720, 720],
			[13.509503365, 52.366222382, null, 720, 720],
			[13.509493828, 52.366146088, null, 721, 721],
			[13.509539604, 52.366039276, null, 721, 721],
			[13.510294914, 52.364833832, null, 725, 725],
		],
	},
}
```

*Note:* In order to work, `computeTrajectories` must load reduced forms of `trips.txt`, `stop_times.txt`, `frequencies.txt` and `shapes.txt` into memory. See [*store API*](#store-api) for more details.


## `optimiseServicesAndExceptions`

A GTFS feed may have a set of `calendar.txt` and/or `calendar_dates.txt` rows that express service days in an overly verbose way. Some examples:

- feeds without `calendar.txt`, where every service day is expressed as a `exception_type=1` (added) exception – In many of such cases, we can reduce the number of exceptions by adding a row in `calendar.txt` with the respective day(s) turned on (e.g. `tuesday=1`).
- feeds with `calendar.txt`, where some services have more `exception_type=2` (removed) exceptions than "regular" day-of-the-week-based service dates (e.g. `thursday=1`) – In this case, we can turn off the "regular" service dates (`thursday=0`) and use `exception_type=1` (added) exceptions.

For each service, **`optimiseServicesAndExceptions` computes the optimal combination of day of the week flags (e.g. `monday=1`) and exceptions, minimalising the number of exceptions necessary to express the set of service dates**.

```js
const readCsv = require('gtfs-utils/read-csv')
const optimiseServices = require('gtfs-utils/optimise-services-and-exceptions')

const readFile = name => readCsv('path/to/gtfs/' + name + '.txt')

const services = readServices(readFile, 'Europe/Berlin')
for await (const [id, changed, service, exceptions] of services) {
	if (changed) {
		console.log(id, 'changed!')
		console.log('service:', service)
		console.log('exceptions:', exceptions)
	} else {
		console.log(id, 'unchanged!', id)
	}
}
```

`optimiseServicesAndExceptions(readFile, timezone, filters = {})` reads `calendar.txt` and `calendar_dates.txt`. It returns an [async iterable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/asyncIterator) of `[serviceId, changed, service, exceptions]` entries.

- If `changed` is `true`,
	- the service's `calendar.txt` row or `calendar_dates.txt` rows (or both) have been optimised,
	- `service` contains the optimised service,
	- `exceptions` contains all `calendar_dates.txt` rows applying to the *optimised* service.
- If `changed` is `false`,
	- the service cannot be optimised,
	- `service` contains the `calendar.txt` as it was before, or a mock service if there was none before,
	- `exceptions` contains the `calendar_dates.txt` rows as they were before.

The [test fixture](../test/fixtures/optimise-services-and-exceptions) contains three services (`more-exceptions-than-regular`, `more-regular-than-exceptions`, should-stay-unchanged), of which the first two can be optimised. With its files as input, the code above will print the following:

```
more-exceptions-than-regular changed!
service: {
	service_id: 'more-exceptions-than-regular',
	start_date: '20220301',
	end_date: '20220410',
	monday: '0',
	tuesday: '0',
	wednesday: '0',
	thursday: '0',
	friday: '0',
	saturday: '0',
	sunday: '0',
}
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
}]

more-regular-than-exceptions changed!
service: {
	service_id: 'more-regular-than-exceptions',
	monday: '1',
	tuesday: '0',
	wednesday: '0',
	thursday: '0',
	friday: '1',
	saturday: '0',
	sunday: '0',
	start_date: '20220301',
	end_date: '20220410',
}
exceptions: []

should-stay-unchanged unchanged! should-stay-unchanged
```
