'use strict'

const recordSort = require('sort-array-by-another')

const inMemoryStore = require('./lib/in-memory-store')
const readAndSortStopTimes = require('./lib/read-and-sort-stop-times')
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
		sequencesByTripId,
		stopsByTripId,
		arrivalsByTripId,
		departuresByTripId,
	} = await readAndSortStopTimes(readFile, filters, {createStore})

	const generateConnectionsByTripId = async function* () {
		for await (const tripId of sequencesByTripId.keys()) {
			const [
				stops,
				arrivals,
				departures,
			] = await Promise.all([
				stopsByTripId.get(tripId),
				arrivalsByTripId.get(tripId),
				departuresByTripId.get(tripId),
			])

			const connections = []
			for (let i = 1; i < stops.length; i++) {
				connections.push({
					tripId,
					fromStop: stops[i - 1],
					departure: departures[i - 1],
					toStop: stops[i],
					arrival: arrivals[i],
				})
			}
			yield connections
		}
	}

	const out = {}
	out[Symbol.asyncIterator] = generateConnectionsByTripId
	return out
}

module.exports = computeConnections
