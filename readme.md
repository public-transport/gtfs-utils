# gtfs-utils

**Utilities to process [GTFS](https://gtfs.org/reference/static/) data sets.**

[![npm version](https://img.shields.io/npm/v/gtfs-utils.svg)](https://www.npmjs.com/package/gtfs-utils)
[![build status](https://api.travis-ci.org/public-transport/gtfs-utils.svg?branch=master)](https://travis-ci.org/public-transport/gtfs-utils)
![ISC-licensed](https://img.shields.io/github/license/public-transport/gtfs-utils.svg)
[![chat on gitter](https://badges.gitter.im/public-transport/Lobby.svg)](https://gitter.im/public-transport/Lobby)
[![support Jannis via GitHub Sponsors](https://img.shields.io/badge/support%20Jannis-donate-fa7664.svg)](https://github.com/sponsors/derhuerst)


## Design goals

### streaming/iterative on sorted data

Whenever possible, all `gtfs-utils` tools will only read as little data into memory as possible. As [public transportation systems will hopefully become more integrated](https://github.com/public-transport/why-linked-open-transit-data#why-linked-open-transit-data) over time, GTFS datasets will often be multiple GBs large. GTFS processing should work in memory-constrained Raspberry Pis or [FaaS](https://en.wikipedia.org/wiki/Function_as_a_service) environments as well.

Read more in the [*performance* section](#performance).

### data-source-agnostic

`gtfs-utils` does not make assumptions about where you read the GTFS data from. Although it has a built-in tool to read CSV from files on disk, anything is possible: in-memory buffers, streaming HTTP, [dat](https://dat.foundation), etc.

There are too many half-done, slightly opinionated GTFS processing tools out there, so `gtfs-utils` tries to be as universal as possible.

### Correctness

Aside from new features of the ever-expanded GTFS spec that change the expected behavior of old ones (and bugs of course), `gtfs-utils` tries to follow the spec closely.

It will, for example, only return an absolute timestamp of an arrival by taking the timezone into account, because [`stop_times.txt` uses "wall clock time"](https://gist.github.com/derhuerst/574edc94981a21ef0ce90713f1cff7f6).


## Installing

```shell
npm install gtfs-utils
```


## Usage

[API documentation](docs/api.md)

### sorted GTFS files

**`gtfs-tidy` assumes that the files in your GTFS dataset are sorted in a particular way**; This allows it to compute some data aggregations more memory-efficiently, which means that you can use it to process [very large](#performance). For example, if [`trips.txt`](https://gtfs.org/reference/static/#tripstxt) and [`stop_times.txt`](https://gtfs.org/reference/static/#stop_timestxt) are both sorted by `trip_id`, `computeStopovers()` can read the data incrementally, only those rows for *one* `trip_id` at a time.

[`xsv`](https://github.com/BurntSushi/xsv) and [`sponge`](https://linux.die.net/man/1/sponge) work very well for this ([with one caveat](https://github.com/BurntSushi/xsv/issues/142#issuecomment-647478949)):

```shell
xsv sort -s agency_id agency.txt | sponge agency.txt
xsv sort -s stop_id stops.txt | sponge stops.txt
xsv sort -s route_id routes.txt | sponge routes.txt
xsv sort -s trip_id trips.txt | sponge trips.txt
xsv sort -s trip_id,stop_sequence stop_times.txt | sponge stop_times.txt
xsv sort -s service_id calendar.txt | sponge calendar.txt
xsv sort -s service_id,date calendar_dates.txt | sponge calendar_dates.txt
xsv sort -s trip_id,start_time frequencies.txt | sponge frequencies.txt
```

There's also a [`sort.sh` script](sort.sh) running the commands available in the npm package.

For read-only sources (like HTTP requests), sorting the files is not an option. You can solve this by using tools that sort data in-memory, e.g. by [spawning](https://nodejs.org/docs/latest-v12.x/api/child_process.html#child_process_child_process_spawn_command_args_options) `xsv` and piping data through it.

### basic example

Given our [sample GTFS dataset](https://npmjs.com/package/sample-gtfs-feed), we'll answer the following question: **On a specific day, which vehicles or which lines stop at a specific station?**

We define a function `readFile` that reads our GTFS data into a [readable stream](https://nodejs.org/api/stream.html#stream_readable_streams)/[async iterable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/asyncIterator). Because we have CSV files on disk, we'll use the built-in `readCsv` helper:

```js
const readCsv = require('gtfs-utils/read-csv')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}
```

[`computerStopovers()`](docs/api.md#computestopovers) will read [`calendar.txt`](https://gtfs.org/reference/static/#calendartxt), [`calendar_dates.txt`](https://gtfs.org/reference/static/#calendar_datestxt), [`trips.txt`](https://gtfs.org/reference/static/#tripstxt), [`stop_times.txt`](https://gtfs.org/reference/static/#stop_timestxt) & [`frequencies.txt`](https://gtfs.org/reference/static/#frequenciestxt) and return all stopovers of all trips across the full time frame of the dataset.

It returns an [async generator function](https://javascript.info/async-iterators-generators#async-generators), and thus also [async-iterable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/asyncIterator), so we can use `for await`:

```js
const {DateTime} = require('luxon')
const computeStopovers = require('gtfs-utils/compute-stopovers')

const day = '2019-05-15'
const isOnDay = (t) => {
	const iso = DateTime.fromMillis(t * 1000, {zone: 'Europe/Berlin'}).toISO()
	return String(t).slice(0, day.length) === day
}

const stopovers = await computeStopovers(readFile, 'Europe/Berlin', filters)
for await (const stopover of stopovers) {
	if (stopover.stop_id !== 'airport') continue
	if (!isOnDay(stopover.arrival)) continue
	console.log(stopover)
}
```

```js
{
	stop_id: 'airport',
	trip_id: 'a-downtown-all-day',
	service_id: 'all-day',
	route_id: 'A',
	start_of_trip: 1557871200,
	arrival: 1557926580,
	departure: 1557926640,
}
{
	stop_id: 'airport',
	trip_id: 'a-outbound-all-day',
	service_id: 'all-day',
	route_id: 'A',
	start_of_trip: 1557871200,
	arrival: 1557933900,
	departure: 1557933960,
}
// …
{
	stop_id: 'airport',
	trip_id: 'c-downtown-all-day',
	service_id: 'all-day',
	route_id: 'C',
	start_of_trip: 1557871200,
	arrival: 1557926820,
	departure: 1557926880,
}
```

For more examples, check the [API documentation](docs/api.md).


## Performance

`gtfs-utils` should be fast enough for small to medium-sized GTFS datasets.

However, with the [2.5GB DELFI dataset](https://www.opendata-oepnv.de/ht/de/organisation/delfi/startseite?tx_vrrkit_view%5Bdataset_name%5D=deutschlandweite-sollfahrplandaten-gtfs&tx_vrrkit_view%5Baction%5D=details&tx_vrrkit_view%5Bcontroller%5D=View) ([download](https://delfi-gtfs-url.now.sh/api/latest)), some operations take hours.

It won't be as fast as other GTFS tools because it

- it uses [async iteration](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/asyncIterator) extensively for memory-efficiency and an easy-of-use, which has inherent performance penalties.
- is written in JavaScript, so it cannot optimise the memory layout of its data structures.
- parses all columns of a file it needs information from, into a JavaScript object.

*Note:* Unfortunately, async iteration currently [seems to be quite slow in v8](https://github.com/nodejs/node/issues/31979).


## Related

- [gtfstidy](https://github.com/patrickbr/gtfstidy) – Go command line tool for validating and tidying GTFS feeds.
- [gtfs-stream](https://github.com/staeco/gtfs-stream) – Streaming GTFS and GTFS-RT parser for node
- [mapzen-gtfs](https://github.com/transitland/mapzen-gtfs) – Python library for reading and writing GTFS feeds. (Python)


## Contributing

If you have a question or have difficulties using `gtfs-utils`, please double-check your code and setup first. If you think you have found a bug or want to propose a feature, refer to [the issues page](https://github.com/public-transport/gtfs-utils/issues).
