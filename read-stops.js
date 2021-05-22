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
	let firstCollect = true
	let curParentStation = NaN
	let curLocType = NaN
	let childIds = []

	for await (let s of await readFile('stops')) {
		if (!stopFilter(s)) continue


		const locType = s.location_type === '' || s.location_type === undefined
			? STOP : s.location_type

		// just insert stations & plain/orphan stops
		if (locType === STATION) {
			await stops.set(s.stop_id, {
				...s,
				stops: [],
				entrances: [],
				boardingAreas: [],
			})
			continue
		}
		if (locType === STOP && !s.parent_station) {
			await stops.set(s.stop_id, s)
			continue
		}

		if (!s.parent_station) continue
		if (
			locType !== STOP
			&& locType !== ENTRANCE_EXIT
			&& locType !== BOARDING_AREA
		) continue

		// collect all items of one kind for one station
		if (s.parent_station !== curParentStation || locType !== curLocType) {
			if (firstCollect) firstCollect = false
			else {
				await stops.map(curParentStation, (station) => {
					if (!station) {
						// todo: debug-log?
						return;
					}

					const key = ({
						[STOP]: 'stops',
						[ENTRANCE_EXIT]: 'entrances',
						[BOARDING_AREA]: 'boardingAreas',
					})[curLocType]
					station[key] = childIds
					return station
				})
			}

			curParentStation = s.parent_station
			curLocType = locType
			childIds = [s.stop_id]
		} else {
			childIds.push(s.stop_id)
		}
	}

	// store pending child IDs
	await stops.map(curParentStation, (station) => {
		if (!station) {
			// todo: debug-log?
			return;
		}

		const key = ({
			[STOP]: 'stops',
			[ENTRANCE_EXIT]: 'entrances',
			[BOARDING_AREA]: 'boardingAreas',
		})[curLocType]
		station[key] = childIds
		return station
	})

	return stops
}

module.exports = readStops
