'use strict'

const inMemoryStore = require('./lib/in-memory-store')
const expectSorting = require('./lib/expect-sorting')

const readTrips = async (readFile, filters = {}, opt = {}) => {
	if (typeof readFile !== 'function') {
		throw new TypeError('readFile must be a function')
	}
	const {
		trip: tripFilter,
	} = {
		trip: () => true,
		...filters,
	}
	if (typeof tripFilter !== 'function') {
		throw new TypeError('filters.trip must be a function')
	}

	const {
		createStore,
		formatTrip,
	} = {
		createStore: inMemoryStore,
		formatTrip: row => row,
		...opt,
	}

	const checkSorting = expectSorting('trips', (a, b) => {
		if (a.trip_id === b.trip_id) return 0
		return a.trip_id < b.trip_id ? -1 : 1
	})

	const trips = createStore() // by ID
	for await (const t of await readFile('trips')) {
		if (!tripFilter(t)) continue
		checkSorting(t)
		await trips.set(t.trip_id, formatTrip(t))
	}

	return trips
}

module.exports = readTrips
