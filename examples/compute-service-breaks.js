'use strict'

const computeServiceBreaks = require('../compute-service-breaks')
const readCsv = require('../read-csv')
const computeSortedConnections = require('../compute-sorted-connections')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

computeSortedConnections(readFile, {}, 'Europe/Berlin')
.then((connections) => {
	const {findBetween, data} = computeServiceBreaks(connections)

	const breaks = findBetween('airport', 'lake', '2019-05-08T12:00:00+02:00', '2019-05-10T15:00:00+02:00')
	console.log(breaks)
})
.catch(console.error)
