'use strict'

const readStopTimes = require('./lib/read-stop-times')

// todo: respect stopover.stop_timezone & agency.agency_timezone
const computeConnections = async function* (readFile, filters = {}, opt = {}) {
	if ('function' !== typeof readFile) {
		throw new Error('readFile must be a function.')
	}

	filters = {
		trip: () => true,
		stopTime: () => true,
		frequenciesRow: () => true,
		...filters,
	}
	if ('function' !== typeof filters.trip) {
		throw new Error('filters.trip must be a function.')
	}
	if ('function' !== typeof filters.stopTime) {
		throw new Error('filters.stopTime must be a function.')
	}
	if ('function' !== typeof filters.frequenciesRow) {
		throw new Error('filters.frequenciesRow must be a function.')
	}

	for await (const _ of readStopTimes(readFile, filters)) {
		const {
			tripId,
			stops, arrivals, departures,
			headwayBasedStarts: hwStarts,
			headwayBasedEnds: hwEnds,
			headwayBasedHeadways: hwHeadways,
		} = _

		const connections = []

		// scheduled connections
		for (let i = 1; i < stops.length; i++) {
			connections.push({
				tripId,
				fromStop: stops[i - 1],
				departure: departures[i - 1],
				toStop: stops[i],
				arrival: arrivals[i],
				headwayBased: false,
			})
		}

		// headway-based connections
		// todo: DRY with compute-stopover-times
		const t0 = arrivals[0]
		const hwStartsL = hwStarts ? hwStarts.length : 0
		for (let h = 0; h < hwStartsL; h++) {
			for (let t = hwStarts[h]; t < hwEnds[h]; t += hwHeadways[h]) {
				for (let i = 1; i < stops.length; i++) {
					connections.push({
						tripId,
						fromStop: stops[i - 1],
						departure: t + departures[i - 1] - t0,
						toStop: stops[i],
						arrival: t + arrivals[i] - t0,
						headwayBased: true,
					})
				}
			}
		}

		yield connections
	}
}

module.exports = computeConnections
