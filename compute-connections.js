'use strict'

const recordSort = require('sort-array-by-another')

const inMemoryStore = require('./lib/in-memory-store')
const readStopTimes = require('./lib/read-stop-times')
const parseRelativeTime = require('./lib/parse-relative-time')
const errorsWithRow = require('./lib/errors-with-row')

const isObj = o => 'object' === typeof o && o !== null && !Array.isArray(o)

const computeConnections = async (readFile, timezone, filters = {}, opt = {}) => {
	if ('function' !== typeof readFile) {
		throw new Error('readFile must be a function.')
	}

	if (!isObj(filters)) throw new Error('filters must be an object.')
	filters = {
		trip: () => true,
		stopover: () => true,
		frequenciesRow: () => true,
		...filters,
	}
	if ('function' !== typeof filters.trip) {
		throw new Error('filters.trip must be a function.')
	}
	if ('function' !== typeof filters.stopover) {
		throw new Error('filters.stopover must be a function.')
	}

	const {
		createStore,
	} = {
		createStore: inMemoryStore,
		...opt,
	}

	const {
		stopsByTripId,
		arrivalsByTripId,
		departuresByTripId,
		headwayBasedStarts, headwayBasedEnds, headwayBasedHeadways,
		closeStores,
	} = await readStopTimes(readFile, filters, {createStore})

	const generateConnectionsByTripId = async function* () {
		for await (const tripId of stopsByTripId.keys()) {
			const [
				stops,
				arrivals,
				departures,
				hwStarts,
				hwEnds,
				hwHeadways,
			] = await Promise.all([
				stopsByTripId.get(tripId),
				arrivalsByTripId.get(tripId),
				departuresByTripId.get(tripId),
				headwayBasedStarts.get(tripId),
				headwayBasedEnds.get(tripId),
				headwayBasedHeadways.get(tripId),
			])
			const connections = []

			// scheduled connections
			for (let i = 1; i < stops.length; i++) {
				connections.push({
					tripId,
					fromStop: stops[i - 1],
					departure: departures[i - 1],
					toStop: stops[i],
					arrival: arrivals[i],
				})
			}

			// headway-based connections
			// todo: DRY with compute-stopover-times
			if (hwStarts) {
				const t0 = arrivals[0]
				for (let i = 0; i < hwStarts.length; i++) {
					for (let t = hwStarts[i]; t < hwEnds[i]; t += hwHeadways[i]) {
						for (let j = 1; j < stops.length; j++) {
							connections.push({
								tripId,
								fromStop: stops[j - 1],
								departure: t + departures[j - 1] - t0,
								toStop: stops[j],
								arrival: t + arrivals[j] - t0,
								headwayBased: true, // todo: pick a more helpful flag?
							})
						}
					}
				}
			}

			yield connections
		}

		await closeStores()
	}

	const out = {}
	out[Symbol.asyncIterator] = generateConnectionsByTripId
	out.closeStores = closeStores
	return out
}

module.exports = computeConnections
