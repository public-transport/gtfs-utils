'use strict'

const {Transform} = require('stream')
const pump = require('pump')

const inMemoryStore = require('./lib/in-memory-store')
const readStopTimes = require('./lib/read-stop-times')
const readServicesAndExceptions = require('./read-services-and-exceptions')
const processFile = require('./lib/process-file')
const parseTime = require('./parse-time')
const resolveTime = require('./lib/resolve-time')

const isObj = o => 'object' === typeof o && o !== null && !Array.isArray(o)

// todo: respect stopover.stop_timezone & agency.agency_timezone
const computeStopoverTimes = async function* (readFile, timezone, filters = {}, opt = {}) {
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
	} = await readStopTimes(readFile, filters, {createStore})

	const services = await readServicesAndExceptions(readFile, timezone, filters)

	const trips = createStore()
	const processTrip = async (t) => {
		if (!filters.trip(t)) return;
		await trips.set(t.trip_id, [t.service_id, t.route_id])
	}
	await processFile('trips', readFile('trips'), processTrip)

	for await (const tripId of stopsByTripId.keys()) {
		const t = await trips.get(tripId)
		if (!t) continue
		const [serviceId, routeId] = t
		const days = await services.get(serviceId)
		if (!days) continue

		const [
			stops, arrs, deps,
			hwStarts, hwEnds, hwHeadways,
		] = await Promise.all([
			stopsByTripId.get(tripId),
			arrivalsByTripId.get(tripId),
			departuresByTripId.get(tripId),
			headwayBasedStarts.get(tripId),
			headwayBasedEnds.get(tripId),
			headwayBasedHeadways.get(tripId),
		])

		for (const day of days) {
			// schedule-based
			for (let i = 0; i < stops.length; i++) {
				yield {
					stop_id: stops[i],
					trip_id: tripId,
					service_id: serviceId,
					route_id: routeId,
					start_of_trip: day,
					arrival: resolveTime(timezone, day, arrs[i]),
					departure: resolveTime(timezone, day, deps[i]),
				}
			}

			// headway-based
			// todo: DRY with compute-connections
			const t0 = arrs[0]
			const hwStartsL = hwStarts ? hwStarts.length : 0
			for (let h = 0; h < hwStartsL; h++) {
				for (let t = hwStarts[h]; t < hwEnds[h]; t += hwHeadways[h]) {
					for (let i = 0; i < stops.length; i++) {
						const arr = t + arrs[i] - t0
						const dep = t + deps[i] - t0
						yield {
							stop_id: stops[i],
							trip_id: tripId,
							service_id: serviceId,
							route_id: routeId,
							start_of_trip: day,
							arrival: resolveTime(timezone, day, arr),
							departure: resolveTime(timezone, day, dep),
							headwayBased: true,
						}
					}
				}
			}
		}
	}

	await closeStores()
}

module.exports = computeStopoverTimes
