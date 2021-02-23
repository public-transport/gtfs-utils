'use strict'

// Type of the location:
// - `0` (or blank): Stop (or Platform). A location where passengers board or disembark from a transit vehicle. Is called a platform when defined within a parent_station.
// - `1`: Station. A physical structure or area that contains one or more platform.
// https://gtfs.org/reference/static/#stopstxt
const STATION = '1'

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

	// todo: expect stops.csv to be sorted by location_type, resolve parents on-the-fly

	const tzs = createStore() // stop_timezone by stop_id
	const parents = createStore() // parent_station by stop_id

	for await (const s of readFile('stops')) {
		if (
			('location_type' in s)
			&& !['', '0', STATION].includes(s.location_type)
		) continue
		if (!filters.stop(s)) continue

		await tzs.set(s.stop_id, s.stop_timezone || null)
		if (s.location_type !== STATION && s.parent_station) {
			await parents.set(s.stop_id, s.parent_station)
		}
	}

	for await (const [id, parentId] of parents.entries()) {
		if (await tzs.has(parentId)) {
			await tzs.set(id, await tzs.get(parentId))
		}
	}

	return tzs
}

module.exports = readStopTimezones
