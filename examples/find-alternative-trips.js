'use strict'

const readCsv = require('../read-csv')
const inMemoryStore = require('../lib/in-memory-store')
const readServices = require('../read-services-and-exceptions')
const computeSchedules = require('../compute-schedules')
const findAlternativeTrips = require('../find-alternative-trips')

const timezone = 'Europe/Berlin'
const noFilter = () => true
const noFilters = {}

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

;(async () => {
	// read services into in-memory store
	const services = inMemoryStore()
	for await (const [id, svc] of readServices(readFile, timezone, noFilters)) {
		await services.set(id, svc)
	}

	// read schedules
	const schedules = await computeSchedules(readFile, noFilters)

	// travel times of a downtown trip of the A line
	const fromId = 'airport'
	const tDep = Date.parse('2019-03-05T15:24:00+01:00') / 1000
	const toId = 'center'
	const tArr = Date.parse('2019-03-05T15:35:00+01:00') / 1000

	// find an alternative trip of the C line
	const altTrips = await findAlternativeTrips(
		readFile,
		timezone,
		services,
		schedules,
	)
	const alts = altTrips(fromId, tDep, toId, tArr)
	for await (const alt of alts) console.log(alt)
})()
.catch((err) => {
	console.error(err)
	process.exit(1)
})
