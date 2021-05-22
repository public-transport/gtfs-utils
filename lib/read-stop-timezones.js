'use strict'

const {STOP, STATION, BOARDING_AREA} = require('./location-types')

const readStopTimezones = async (readFile, filters, createStore) => {
	if ('function' !== typeof readFile) {
		throw new Error('readFile must be a function.')
	}
	if ('function' !== typeof filters.stop) {
		throw new Error('filters.stop must be a function.')
	}
	if ('function' !== typeof createStore) {
		throw new Error('createStore must be a function.')
	}

	const tzs = createStore() // station/stop timezone, by stop_id
	for await (const s of await readFile('stops')) {
		if (
			('location_type' in s)
			&& !['', STOP, STATION].includes(s.location_type)
		) continue
		if (!filters.stop(s)) continue

		const tz = s.parent_station
			? (await tzs.get(s.parent_station)) || s.stop_timezone
			: s.stop_timezone
		if (tz) await tzs.set(s.stop_id, tz)
	}

	return tzs
}

module.exports = readStopTimezones
