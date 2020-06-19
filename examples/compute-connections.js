'use strict'

const readCsv = require('../read-csv')
const computeConnections = require('../compute-connections')
const redisStore = require('../lib/redis-store')

const readFile = (file) => {
	// return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
	return readCsv('/Users/j/playground/delfi-gtfs/2020-05-29/' + file + '.txt')
}

;(async () => {
	const connectionsByTripId = await computeConnections(readFile, 'Europe/Berlin', {
		// trip: t => t.route_id === '197626_3',
	}, {
		createStore: redisStore,
	})
	for await (const connectionsOfTrip of connectionsByTripId) {
		// console.log('')
		// for (let connection of connectionsOfTrip) {
		// 	console.log(JSON.stringify(connection))
		// }
	}
})()
.catch((err) => {
	console.error(err)
	process.exitCode = 1
})
