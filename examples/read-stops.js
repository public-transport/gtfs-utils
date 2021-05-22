'use strict'

const readCsv = require('../read-csv')
const readStops = require('../read-stops')

const readFile = async (file) => {
	return await readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

;(async () => {
	const stops = await readStops(readFile)
	for await (const stop of stops.values()) {
		console.log(stop)
	}
})()
.catch((err) => {
	console.error(err)
	process.exit(1)
})
