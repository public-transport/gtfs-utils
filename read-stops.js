'use strict'

const inMemoryStore = require('./lib/in-memory-store')
const {
	STOP,
	STATION,
	ENTRANCE_EXIT,
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

	const stops = createStore() // by stop_id
	const allOthers = createStore() // by stop_id

	for await (let s of readFile('stops')) {
		if (!stopFilter(s)) continue
		const locType = s.location_type

		if (locType === STOP || locType === '' || locType === undefined) {
			await stops.set(s.stop_id, s)
		} else if (locType === STATION) {
			s = {
				...s,
				stops: [],
				entrances: [],
				boardingAreas: [],
			}
			await stops.set(s.stop_id, s)
		} else if (
			(locType === ENTRANCE_EXIT || locType === BOARDING_AREA)
			&& s.parent_station
		) {
			await allOthers.set(s.stop_id, s) // todo: parse/simplify?
		}
	}

	for await (const [id, stop] of stops.entries()) {
		if (
			// skip if it's a station
			stop.location_type === STATION
			// skip if if the stop doesn't have a parent station
			|| !stop.parent_station
		) continue

		await stops.map(stop.parent_station, (station) => {
			if (!station) return;
			station.stops.push(id)
			return station
		})
	}

	for await (const [id, item] of allOthers.entries()) {
		await stops.map(item.parent_station, (stop) => {
			if (!stop) return;
			if (item.location_type === ENTRANCE_EXIT) {
				stop.entrances.push(id)
			} else if (item.location_type === BOARDING_AREA) {
				stop.boardingAreas.push(id)
			}
			return stop
		})
	}

	return stops
}

module.exports = readStops
