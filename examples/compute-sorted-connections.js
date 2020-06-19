'use strict'

const readCsv = require('../read-csv')
const computeSortedConnections = require('../compute-sorted-connections')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
	// return readCsv('/Users/j/playground/delfi-gtfs/2020-05-29/' + file + '.txt')
}

;(async () => {
	computeSortedConnections(readFile, {
		trip: t => t.route_id === '197626_3',
	}, 'Europe/Berlin')
	// todo
})()
.catch(console.error)
