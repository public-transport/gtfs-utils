# using `gtfs-utils` with `.zip` Archives

Although `gtfs-utils` strongly favors GTFS datasets to be distributed as a set of individual files, feed authors strictly adhering to the GTFS spec bundle all files into a [`.zip` archive](https://en.wikipedia.org/wiki/ZIP_(file_format)).

The following code sample shows you how to benefit from `gtfs-util`'s streaming/iterative processing while still reading directly from a `.zip` archive:

```js
const {async: ZipArchive} = require('node-stream-zip') // node-stream-zip@1
const readCsv = require('gtfs-utils/read-csv')
const computeStopovers = require('gtfs-utils/compute-stopovers')

// Define a readFile() function that reads from the GTFS .zip
// archive on-the-fly and parses the CSV data.
const zip = new ZipArchive('path/to/gtfs.zip')
const readFile = async (name) => {
	const file = await zip.stream(name + '.txt')
	return await readCsv(file)
}

const stopovers = computeStopovers(readFile, 'Europe/Berlin')
for await (const stopover of stopovers) console.log(stopover)

await zip.close() // We're done reading data, close .zip archive.
```

*Note:* As `gtfs-utils` expects the files/data to be sorted in a specific way, the data inside the `.zip` archive must already be sorted, or you need to [sort the files as explained](../readme.md#sorted-gtfs-files).
