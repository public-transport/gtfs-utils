'use strict'

const readCsv = require('../read-csv')
const computeSortedConnections = require('../compute-sorted-connections')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

;(async () => {
	const sortedCons = await computeSortedConnections(readFile, 'Europe/Berlin')
	for (const connection of sortedCons) {
		console.log(connection)
	}
})()
.catch((err) => {
	console.error(err)
	process.exit(1)
})
