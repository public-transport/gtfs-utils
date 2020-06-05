'use strict'

const inMemoryStore = require('./lib/in-memory-store')
const reduce = require('./lib/reduce')

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

	const file = readFile('trips')
	await reduce('trips', file, trips, processTrip)

	return trips
}

module.exports = readTrips
