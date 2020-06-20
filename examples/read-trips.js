'use strict'

const readCsv = require('../read-csv')
const readTrips = require('../read-trips')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

;(async () => {
	const trips = await readTrips(readFile)
	for await (const trip of trips.values()) {
		console.log(trip)
	}
})()
.catch((err) => {
	console.error(err)
	process.exit(1)
})
