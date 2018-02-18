'use strict'

const readCsv = require('../read-csv')
const computeStopoverTimes = require('../compute-stopover-times')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

const filter = (stopover) => (
	stopover.trip_id === 'b-downtown-on-working-days' &&
	stopover.stop_id === 'airport'
)

const times = computeStopoverTimes(readFile, {stopover: filter}, 'Europe/Berlin')

times.on('error', console.error)
times.on('data', console.log)
