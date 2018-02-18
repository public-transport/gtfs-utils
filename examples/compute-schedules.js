'use strict'

const readCsv = require('../read-csv')
const computeSchedules = require('../compute-schedules')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

computeSchedules(readFile)
.then((schedules) => {
	console.log(schedules)
})
.catch(console.error)
