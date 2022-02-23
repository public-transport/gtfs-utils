# gtfs-utils

**Utilities to process [GTFS](https://gtfs.org/reference/static/) data sets.**

[![npm version](https://img.shields.io/npm/v/gtfs-utils.svg)](https://www.npmjs.com/package/gtfs-utils)
![ISC-licensed](https://img.shields.io/github/license/public-transport/gtfs-utils.svg)
![minimum Node.js version](https://img.shields.io/node/v/gtfs-utils.svg)
[![support me via GitHub Sponsors](https://img.shields.io/badge/support%20me-donate-fa7664.svg)](https://github.com/sponsors/derhuerst)
[![chat with me on Twitter](https://img.shields.io/badge/chat%20with%20me-on%20Twitter-1da1f2.svg)](https://twitter.com/derhuerst)

- ✅ supports `frequencies.txt`
- ✅ works in the browser
- ✅ fully asynchronous/streaming


## Design goals

### streaming/iterative on sorted data

As [public transportation systems will hopefully become more integrated](https://github.com/public-transport/why-linked-open-transit-data#why-linked-open-transit-data) over time, GTFS datasets will often be multiple GBs large. GTFS processing should work in memory-constrained Raspberry Pis or [FaaS](https://en.wikipedia.org/wiki/Function_as_a_service) environments as well.

Whenever possible, all `gtfs-utils` tools will only read as little data into memory as possible. For this, the individual files in a GTFS dataset need to be [sorted in a way](#sorted-gtfs-files) that allows iterative processing.

Read more in the [*performance* section](#performance).

### data-source-agnostic

`gtfs-utils` does not make assumptions about where you read the GTFS data from. Although it has a built-in tool to read CSV from files on disk, anything is possible: [`.zip` archives](docs/zip.md), [HTTP requests](docs/fetch.md), in-memory [buffers](https://nodejs.org/api/buffer.html), [dat](https://dat.foundation)/[IPFS](https://ipfs.io), etc.

There are too many half-done, slightly opinionated GTFS processing tools out there, so `gtfs-utils` tries to be as universal as possible.

### correct

Aside from new features of the ever-expanded GTFS spec that change the expected behavior of old ones (and bugs of course), `gtfs-utils` tries to follow the spec closely.

For example, it will, when computing the absolute timestamp/instant of an arrival at a stop, always take into account `stop_timezone` or the user-supplied timezone, because [`stop_times.txt` uses "wall clock time"](https://gist.github.com/derhuerst/574edc94981a21ef0ce90713f1cff7f6).


## Installing

```shell
npm install gtfs-utils
```


## Usage

[API documentation](docs/api.md)

### sorted GTFS files

**`gtfs-utils` assumes that the files in your GTFS dataset are sorted in a particular way**; This allows it to compute some data aggregations more memory-efficiently, which means that you can use it to process [very large](#performance) datasets. For example, if [`trips.txt`](https://gtfs.org/reference/static/#tripstxt) and [`stop_times.txt`](https://gtfs.org/reference/static/#stop_timestxt) are both sorted by `trip_id`, `computeStopovers()` can read each file incrementally, only rows for *one* `trip_id` at a time.

[Miller](https://miller.readthedocs.io/) and [`sponge`](https://linux.die.net/man/1/sponge) work very well for this:

```shell
mlr --csv sort -f agency_id agency.txt | sponge agency.txt
mlr --csv sort -f parent_station -nr location_type stops.txt | sponge stops.txt
mlr --csv sort -f route_id routes.txt | sponge routes.txt
mlr --csv sort -f trip_id trips.txt | sponge trips.txt
mlr --csv sort -f trip_id -n stop_sequence stop_times.txt | sponge stop_times.txt
mlr --csv sort -f service_id calendar.txt | sponge calendar.txt
mlr --csv sort -f service_id,date calendar_dates.txt | sponge calendar_dates.txt
mlr --csv sort -f trip_id,start_time frequencies.txt | sponge frequencies.txt
```

There's also a [`sort.sh` script](sort.sh) included in the npm package, which executes the commands above.

*Note:* For read-only sources (like HTTP requests), sorting the files is not an option. You can solve this by [spawning](https://nodejs.org/docs/latest-v12.x/api/child_process.html#child_process_child_process_spawn_command_args_options) `mlr` and piping data through it.

*Note:* With a bit of extra code, you can also use `gtfs-utils` [with a `.zip` archive](docs/zip.md) or [with a *remote* feed](docs/fetch.md).

### basic example

Given our [sample GTFS dataset](https://npmjs.com/package/sample-gtfs-feed), we'll answer the following question: **On a specific day, which vehicles of which lines stop at a specific station?**

We define a function `readFile` that reads our GTFS data into a [readable stream](https://nodejs.org/api/stream.html#stream_readable_streams)/[async iterable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/asyncIterator). In this case we'll read CSV files from disk using the built-in `readCsv` helper:

```js
const readCsv = require('gtfs-utils/read-csv')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}
```

[`computerStopovers()`](docs/api.md#computestopovers) will read [`calendar.txt`](https://gtfs.org/reference/static/#calendartxt), [`calendar_dates.txt`](https://gtfs.org/reference/static/#calendar_datestxt), [`trips.txt`](https://gtfs.org/reference/static/#tripstxt), [`stop_times.txt`](https://gtfs.org/reference/static/#stop_timestxt) & [`frequencies.txt`](https://gtfs.org/reference/static/#frequenciestxt) and return all *stopovers* of all trips across the full time frame of the dataset.

It returns an [async generator function](https://javascript.info/async-iterators-generators#async-generators) (which thus is [async-iterable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/asyncIterator)), so we can use `for await`.

In the following example, we're going to print all stopovers at `airport` on the 5th of May 2019:

```js
const {DateTime} = require('luxon')
const computeStopovers = require('gtfs-utils/compute-stopovers')

const day = '2019-05-15'
const isOnDay = (t) => {
	const iso = DateTime.fromMillis(t * 1000, {zone: 'Europe/Berlin'}).toISO()
	return String(t).slice(0, day.length) === day
}

const stopovers = await computeStopovers(readFile, 'Europe/Berlin')
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

By default, `gtfs-utils` verifies that the input files are sorted correctly. You can disable this to improve performance slightly by running with the `CHECK_GTFS_SORTING=false` environment variable.

`gtfs-utils` should be fast enough for small to medium-sized GTFS datasets. It won't be as fast as other GTFS tools because it

- uses [async iteration](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/asyncIterator) extensively for memory-efficiency and an easy-of-use, which [currently has significant performance penalties in v8](https://github.com/nodejs/node/issues/31979).
- is written in JavaScript, so it cannot optimise the memory layout of its data structures.
- parses all columns of a file it needs information from, into a JavaScript object.

On my [M1 Macbook Air](https://everymac.com/systems/apple/macbook-air/specs/macbook-air-m1-8-core-7-core-gpu-13-retina-display-2020-specs.html), with the [180mb `2022-02-03` *HVV* GTFS dataset](https://suche.transparenz.hamburg.de/dataset/hvv-fahrplandaten-gtfs-februar-2022-bis-dezember-2022) (17k `stops.txt` rows, 91k `trips.txt` rows, 2m `stop_times.txt` rows, ~500m stopovers), `computeStopovers` computes 18k stopovers per second, and finishes in several hours.

*Note:* If you want a faster way to query and transform GTFS datasets, I suggest you to use [`gtfs-via-postgres`](https://github.com/derhuerst/gtfs-via-postgres) to leverage PostgreSQL's query optimizer. Once you have imported the data, it is usually orders of magnitude faster.


## Related

- [gtfstidy](https://github.com/patrickbr/gtfstidy) – Go command line tool for validating and tidying GTFS feeds.
- [gtfs-stream](https://github.com/staeco/gtfs-stream) – Streaming GTFS and GTFS-RT parser for node
- [mapzen-gtfs](https://github.com/transitland/mapzen-gtfs) – Python library for reading and writing GTFS feeds. (Python)
- [gtfspy](https://github.com/CxAalto/gtfspy) – Public transport network analysis using Python
- [extract-gtfs-shapes](https://github.com/derhuerst/extract-gtfs-shapes) – Command-line tool to extract shapes from a GTFS dataset.
- [extract-gtfs-pathways](https://github.com/derhuerst/extract-gtfs-pathways) – Command-line tool to extract pathways from a GTFS dataset.
- [Awesome GTFS: Frameworks and Libraries](https://github.com/andredarcie/awesome-gtfs#frameworks-and-libraries) – A collection of libraries for working with GTFS.

## Contributing

If you have a question or have difficulties using `gtfs-utils`, please double-check your code and setup first. If you think you have found a bug or want to propose a feature, refer to [the issues page](https://github.com/public-transport/gtfs-utils/issues).
