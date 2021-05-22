# using `gtfs-utils` in a browser

You can use `gtfs-utils` with a *remote* GTFS feed efficiently if they are

- hosted as individual files (e.g. on an HTTP server), and
- [sorted in the way that `gtfs-utils` needs them](../readme.md#sorted-gtfs-files).

This way, you can process the files incrementally *while* they are being downloaded chunk by chunk. **The following example shows how to use the [`fetch` Web API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) for that.**

Because a [`fetch` response body](https://developer.mozilla.org/en-US/docs/Web/API/Body/body) is a [Web Streams API `ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) and `gtfs-utils/read-csv` needs a [Node.js `stream.Readable`](https://nodejs.org/docs/latest-v14.x/api/stream.html), adapting code is necessary.

```js
const {Readable} = require('stream')
const readCsv = require('gtfs-utils/read-csv')
const computeStopovers = require('gtfs-utils/compute-stopovers')

// convert a fetch response body (Web Streams API) into a Node.js stream.Readable
const readableStreamFromResponseBody = (resBody) => {
	const reader = resBody.getReader()
	let bytes = 0
	const readable = new Readable({
		read: () => {
			reader.read()
			.then(({done, value}) => {
				if (done) readable.push(null)
				else {
					bytes += value.buffer.byteLength
					const buf = Buffer.from(value.buffer)
					readable.push(buf)
				}
			})
			.catch(err => readable.destroy(err))
		},
		destroy: (err, cb) => {
			reader.cancel(err && err.message || null)
			.then(() => cb(), () => cb())
		},
	})
	return readable
}

const readFile = async (name) => {
	const res = await fetch(`/${name}.txt`, {
		mode: 'cors',
		headers: {
			'accept': 'text/plain',
		},
	})
	if (!res.ok) { // non-2xx HTTP response
		const err = new Error(`${res.statusText} ${res.url}`)
		// gtfs-utils uses err.statusCode to ignore if optional files
		// (e.g. frequencies.txt) are missing.
		err.statusCode = res.status
		err.res = res
		throw err
	}

	const readable = readableStreamFromResponseBody(res.body)
	return readCsv(readable)
}

const stopovers = computeStopovers(readFile, 'Europe/Berlin')
for await (const stopover of stopovers) console.log(stopover)
```
