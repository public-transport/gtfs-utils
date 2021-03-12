'use strict'

const inMemoryStore = require('./lib/in-memory-store')
const {
	// STOP,
	STATION,
	// ENTRANCE_EXIT,
	GENERIC_NODE,
	BOARDING_AREA,
} = require('./lib/location-types')

const noFilter = () => true

const readStops = async (readFile, filters = {}, opt = {}) => {
	if (typeof readFile !== 'function') {
		throw new TypeError('readFile must be a function')
	}
	const {
		stop: stopFilter,
	} = {
		stop: () => true,
		...filters,
	}
	if (typeof stopFilter !== 'function') {
		throw new TypeError('filters.stop must be a function')
	}

	const {
		createStore,
	} = {
		createStore: inMemoryStore,
		...opt,
	}

	const stops = createStore() // by ID

	for await (let s of readFile('stops')) {
		if (!stopFilter(s)) continue
		// todo: support these
		if (s.location_type === GENERIC_NODE || s.location_type === BOARDING_AREA) continue

		if (s.location_type === STATION) {
			s = {...s, platforms: []}
		}
		await stops.set(s.stop_id, s)
	}

	// todo [breaking]: expect sorting by location_type, fill .platforms while reading
	for await (const [id, stop] of stops.entries()) {
		// todo: add entrances to their parents
		// todo: add boarding areas to their parents
		// todo: add generic nodes to their parents?

		// continue if it's not a stop
		if (
			('location_type' in stop)
			&& stop.location_type !== ''
			&& stop.location_type !== '0'
		) continue

		// continue if if the stop doesn't have a parent station
		if (!stop.parent_station) continue

		// add to stop to station.platforms
		await stops.map(stop.parent_station, (station) => {
			if (!station) return;
			station.platforms.push(id)
			return station
		})
	}

	return stops
}

module.exports = readStops
