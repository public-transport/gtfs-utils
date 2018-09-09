'use strict'

const readCsv = require('../read-csv')
const computeSortedConnections = require('../compute-sorted-connections')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

computeSortedConnections(readFile, {}, 'Europe/Berlin')
.then((sortedConnections) => {
	console.log(sortedConnections.values())
})
.catch(console.error)
