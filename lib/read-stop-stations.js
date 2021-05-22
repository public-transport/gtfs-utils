'use strict'

const readStopStations = async (readFile, filters, createStore) => {
	if ('function' !== typeof readFile) {
		throw new Error('readFile must be a function.')
	}
	if ('function' !== typeof filters.stop) {
		throw new Error('filters.stop must be a function.')
	}
	if ('function' !== typeof createStore) {
		throw new Error('createStore must be a function.')
	}

	const stations = createStore() // station ID by stop_id
	for await (const s of await readFile('stops')) {
		if (!filters.stop(s)) continue

		const stationId = s.parent_station
			? (await stations.get(s.parent_station)) || s.parent_station
			: s.stop_id
		await stations.set(s.stop_id, stationId)
	}

	return stations
}

module.exports = readStopStations
