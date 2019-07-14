'use strict'

const readCsv = require('../read-csv')
const computeConnections = require('../compute-connections')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

computeConnections(readFile, 'Europe/Berlin')
.then((connectionsByTripId) => {
	for (let connectionsOfTrip of connectionsByTripId) {
		console.log('')
		for (let connection of connectionsOfTrip) console.log(connection)
	}
})
.catch((err) => {
	console.error(err)
	process.exitCode = 1
})
