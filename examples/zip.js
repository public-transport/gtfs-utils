'use strict'

const {async: AsyncZipArchive} = require('node-stream-zip') // node-stream-zip@1
const {PassThrough, pipeline} = require('stream')
const readCsv = require('../read-csv')
const computeStopovers = require('../compute-stopovers')

// const ZIP_PATH = require.resolve('sample-gtfs-feed/gtfs.zip')
const ZIP_PATH = require.resolve('/Users/j/web/sample-gtfs-feed/gtfs.zip')

;(async () => {
	const zip = new AsyncZipArchive({file: ZIP_PATH})

	const readFile = (name) => {
		// todo [breaking]: make readFile async, simplify here
		const stream = new PassThrough({highWaterMark: 0})
		zip.stream(name + '.txt')
		.then((file) => new Promise((resolve, reject) => {
			pipeline(file, stream, (err) => {
				if (err) reject(err)
				else resolve()
			})
		}))
		.catch(err => stream.destroy(err))

		return readCsv(stream)
	}

	const stopovers = computeStopovers(readFile, 'Europe/Berlin')
	for await (const stopover of stopovers) console.log(stopover)

	await zip.close() // We're done reading data, close .zip archive.
})()
.catch((err) => {
	console.error(err)
	process.exit(1)
})
