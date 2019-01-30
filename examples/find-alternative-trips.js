'use strict'

const readCsv = require('../read-csv')
const readTrips = require('../read-trips')
const readServices = require('../read-services-and-exceptions')
const computeSchedules = require('../compute-schedules')
const createFindAlternativeTrips = require('../find-alternative-trips')

const timezone = 'Europe/Berlin'
const noFilter = () => true
const noFilters = {}

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

// prerequisites
Promise.all([
	readTrips(readFile, noFilter),
	readServices(readFile, timezone, noFilters),
	computeSchedules(readFile, noFilters)
])
.then(([trips, services, schedules]) => {
	const findAltTrips = createFindAlternativeTrips(trips, services, schedules)

	// travel times of a downtown trip of the A line
	const fromId = 'airport'
	const tDep = new Date('2019-03-05T15:24:00+01:00') / 1000
	const toId = 'center'
	const tArr = new Date('2019-03-05T15:35:00+01:00') / 1000

	// find an alternative trip of the C line
	console.log(findAltTrips(fromId, tDep, toId, tArr))
})
.catch(console.error)
