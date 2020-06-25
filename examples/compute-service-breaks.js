'use strict'

const readCsv = require('../read-csv')
const computeSortedConnections = require('../compute-sorted-connections')
const computeServiceBreaks = require('../compute-service-breaks')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

const start = 1557313200 // 2019-05-08T12:00:00+01:00
const end = 1557496800 // 2019-05-10T15:00:00+01:00

;(async () => {
	let connections = await computeSortedConnections(readFile, 'Europe/Berlin')

	// select time frame
	const startI = connections.findIndex(c => c.departure >= start)
	const endI = connections.findIndex(c => c.departure > end)
	connections = connections.slice(startI, endI)

	for await (const serviceBreak of computeServiceBreaks(connections)) {
		console.log(serviceBreak)
	}
})()
.catch((err) => {
	console.error(err)
	process.exit(1)
})
