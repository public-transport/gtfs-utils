'use strict'

const readCsv = require('../read-csv')
const computeConnections = require('../compute-connections')
const redisStore = require('../lib/redis-store')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

;(async () => {
	const connectionsByTripId = await computeConnections(readFile, 'Europe/Berlin')
	for await (const connectionsOfTrip of connectionsByTripId) {
		for (const connection of connectionsOfTrip) {
			console.log(connection)
		}
	}
})()
.catch((err) => {
	console.error(err)
	process.exitCode = 1
})
