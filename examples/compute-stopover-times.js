'use strict'

const readCsv = require('../read-csv')
const computeStopoverTimes = require('../compute-stopover-times')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

const filters = {
	stopover: s => s.stop_id === 'airport',
}

;(async () => {
	const times = await computeStopoverTimes(readFile, 'Europe/Berlin', filters)
	for await (const stopover of times) {
		console.log(stopover)
	}
})()
.catch((err) => {
	console.error(err)
	process.exit(1)
})
