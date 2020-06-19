'use strict'

const {DateTime} = require('luxon')

// const readServicesAndExceptions = require('./read-services-and-exceptions')
// const readTrips = require('./read-trips')
// const parseTime = require('./parse-time')

const isObj = o => 'object' === typeof o && o !== null && !Array.isArray(o)

const computeSortedConnections = async (readFile, timezone, filters = {}, opt = {}) => {
	if ('function' !== typeof readFile) {
		throw new Error('readFile must be a function.')
	}

	if ('string' !== typeof timezone || !timezone) {
		throw new Error('timezone must be a non-empty string.')
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
	if ('function' !== typeof filters.frequenciesRow) {
		throw new Error('filters.frequenciesRow must be a function.')
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
	} = await readAndSortStopTimes(readFile, filters, {createStore})

	// todo
	// const byDeparture = []

	// for (const tripId in allStopovers) {
	// 	const stopovers = allStopovers[tripId].sort(sortStopovers)
	// 	allStopovers[tripId] = null // allow GC

	// 	const {serviceId, routeId} = trips[tripId]
	// 	const days = services[serviceId]

	// 	for (let i = 0; i < days.length; i++) {
	// 		const day = DateTime.fromMillis(days[i] * 1000, {zone: timezone})

	// 		const maxJ = stopovers.length - 1
	// 		for (let j = 0; j < maxJ; j++) {
	// 			const s1 = stopovers[j]
	// 			const s2 = stopovers[j + 1]

	// 			const dep = day.plus(parseTime(s1.departure_time)) / 1000 | 0
	// 			byDeparture.push([dep, {
	// 				tripId,
	// 				fromStop: s1.stop_id,
	// 				departure: dep,
	// 				toStop: s2.stop_id,
	// 				arrival: day.plus(parseTime(s2.arrival_time)) / 1000 | 0,
	// 				routeId,
	// 				serviceId
	// 			}])
	// 		}
	// 	}

	// byDeparture.sort((a, b) => a[0] - b[0])
	// for (let i = 0; i < byDeparture.length; i++) {
	// 	byDeparture[i] = byDeparture[i][1]
	// }
	// return byDeparture
}

module.exports = computeSortedConnections
