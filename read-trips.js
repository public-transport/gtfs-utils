'use strict'

const inMemoryStore = require('./lib/in-memory-store')
const processFile = require('./lib/process-file')

const noFilter = () => true

const readTrips = async (readFile, filter = noFilter, opt = {}) => {
	const {
		createStore,
	} = {
		createStore: inMemoryStore,
		...opt,
	}

	const trips = createStore()
	const processTrip = async (t) => {
		if (!filter(t)) return;
		await trips.set(t.trip_id, t)
	}
	await processFile('trips', readFile('trips'), processTrip)

	return trips
}

module.exports = readTrips
