'use strict'

const debug = require('debug')('gtfs-utils:read-stops')

const noFilter = () => true

const readStops = (readFile, filter = noFilter) => {
	return new Promise((resolve, reject) => {
		const data = readFile('stops')
		data.once('error', (err) => {
			reject(err)
			data.destroy(err)
		})

		const stops = Object.create(null) // by ID
		data.on('data', (s) => {
			if (!filter(s)) return;
			// todo: support these
			if (s.location_type === '3' || s.location_type === '4') return;

			if (s.location_type === '1') {
				s = {...s, child_stops: []}
			}
			stops[s.stop_id] = s
		})

		data.once('end', (err) => {
			if (err) return;

			for (const id in stops) {
				const stop = stops[id]
				const isStop = (
					!('location_type' in stop) ||
					stop.location_type === '0'
				)
				if (
					isStop &&
					stop.parent_station &&
					(stop.parent_station in stops)
				) {
					const station = stops[stop.parent_station]
					station.child_stops.push(id)
				}
			}

			setImmediate(resolve, stops)
		})
	})
}

module.exports = readStops
