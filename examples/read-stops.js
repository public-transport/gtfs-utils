'use strict'

const readCsv = require('../read-csv')
const readStops = require('../read-stops')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

readStops(readFile)
.then((stops) => {
	for (const stop of Object.values(stops)) {
		console.log(stop)
	}
})
.catch((err) => {
	console.error(err)
	process.exitCode = 1
})
