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

readCsv('path-to-file.csv')
.on('error', console.error)
.on('data', console.log)
```

Returns a [readable stream](https://nodejs.org/api/stream.html#stream_readable_streams) with CSV *as text*.

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

### `computeStopoverTimes(data, filters, timezone)`

```js
const computeStopoverTimes = require('gtfs-utils/compute-stopover-times')
const readCsv = require('gtfs-utils/read-csv')

const filters = {
	service: s => s.monday === '1',
	trip: t => t.route_id === 'A',
	stopover: s => s.stop_id === 'some-stop-id'
}
const stopovers = computeStopoverTimes({
	services: readCsv('path/to/calendar.csv'),
	serviceExceptions: readCsv('path/to/calendar_dates.csv'),
	trips: readCsv('path/to/trips.csv'),
	stopovers: readCsv('path/to/stop_times.csv')
}, filters, 'Europe/Berlin')

stopovers
.on('error', console.error)
.on('data', console.log)
```

Returns a [readable stream](https://nodejs.org/api/stream.html#stream_readable_streams) on [`objectMode`](https://nodejs.org/api/stream.html#stream_object_mode).

- `data` must be an object, with four fields `services`, `serviceExceptions`, `trips`, `stopovers`, each with the respective readable stream.
- `filters` must be an object; It may have the fields `service`, `trip`, `stopover`, each with a filter function.
- `timezone` must a timezone name from the [tz database](https://en.wikipedia.org/wiki/Tz_database#Names_of_time_zones).

A single item from the stream may look like this:

```js
{
	stop_id: 'airport',
	trip_id: 'b-downtown-on-working-days',
	service_id: 'on-working-days',
	sequence: '1',
	arrival: 1557486780,
	departure: 1557486840
}
```


## Contributing

If you have a question or have difficulties using `gtfs-utils`, please double-check your code and setup first. If you think you have found a bug or want to propose a feature, refer to [the issues page](https://github.com/public-transport/gtfs-utils/issues).
