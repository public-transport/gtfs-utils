'use strict'

const inMemoryStore = require('./lib/in-memory-store')
const reduce = require('./lib/reduce')

const noFilter = () => true

const readStops = async (readFile, filter = noFilter, opt = {}) => {
	const {
		createStore,
	} = {
		createStore: inMemoryStore,
		...opt,
	}

	const stops = createStore()
	const processStop = async (s) => {
		if (!filter(s)) return;
		// todo: support these
		if (s.location_type === '3' || s.location_type === '4') return;

		if (s.location_type === '1') {
			s = {...s, child_stops: []}
		}
		await stops.set(s.stop_id, s)
	}

	const file = readFile('stops')
	await reduce('stops', file, stops, processStop)

	for await (const [id, stop] of stops.entries()) {
		// continue if it's not a stop
		// todo: add entrances to their parents
		// todo: add boarding areas to their parents
		// todo: add generic nodes to their parents?
		if (
			('location_type' in stop)
			&& stop.location_type !== '0'
		) continue

		// continue if if the stop doesn't have a parent station
		if (!stop.parent_station) continue
		const station = await stops.get(stop.parent_station)
		if (!station) continue

		// add to stop to station.child_stops
		station.child_stops.push(id)
		await stops.set(stop.parent_station, station)
	}

	return stops
}

module.exports = readStops
