'use strict'

const readCsv = require('../read-csv')
const computeStopovers = require('../compute-stopovers')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

;(async () => {
	const stopovers = computeStopovers(readFile, 'Europe/Berlin', {
		stopTime: s => s.stop_id === 'airport',
	})
	for await (const stopover of stopovers) {
		console.log(stopover)
	}
})()
.catch((err) => {
	console.error(err)
	process.exit(1)
})
