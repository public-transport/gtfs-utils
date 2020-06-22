'use strict'

const debug = require('debug')('gtfs-utils:compute-stopover-times')

const inMemoryStore = require('./lib/in-memory-store')
const expectSorting = require('./lib/expect-sorting')
const readStopTimes = require('./lib/read-stop-times')
const readServicesAndExceptions = require('./read-services-and-exceptions')
const resolveTime = require('./lib/resolve-time')

// todo: respect stopover.stop_timezone & agency.agency_timezone
const computeStopovers = async function* (readFile, timezone, filters = {}, opt = {}) {
	if ('function' !== typeof readFile) {
		throw new Error('readFile must be a function.')
	}

	if ('string' !== typeof timezone || !timezone) {
		throw new Error('timezone must be a non-empty string.')
	}

	filters = {
		trip: () => true,
		service: () => true,
		serviceException: () => true,
		stopTime: () => true,
		frequenciesRow: () => true,
		...filters,
	}
	if ('function' !== typeof filters.trip) {
		throw new Error('filters.trip must be a function.')
	}
	if ('function' !== typeof filters.service) {
		throw new Error('filters.service must be a function.')
	}
	if ('function' !== typeof filters.serviceException) {
		throw new Error('filters.serviceException must be a function.')
	}
	if ('function' !== typeof filters.stopTime) {
		throw new Error('filters.stopTime must be a function.')
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

	const svcIdsByTripId = createStore()
	const routeIdsByTripId = createStore()

	debug('reading trips')
	// todo: DRY with read-trips.js
	const checkSorting = expectSorting('trips', (a, b) => {
		if (a.trip_id === b.trip_id) return 0
		return a.trip_id < b.trip_id ? -1 : 1
	})
	for await (const t of readFile('trips')) {
		if (!filters.trip(t)) continue
		checkSorting(t)
		await Promise.all([
			svcIdsByTripId.set(t.trip_id, t.service_id),
			routeIdsByTripId.set(t.trip_id, t.route_id),
		])
	}

	debug('reading services & exceptions')
	const _services = readServicesAndExceptions(readFile, timezone, filters)
	const services = createStore() // by service ID
	for await (const [id, days] of _services) {
		await services.set(id, days)
	}

	debug('reading stop times')
	for await (const _ of readStopTimes(readFile, filters)) {
		const {
			tripId,
			stops, arrivals: arrs, departures: deps,
			headwayBasedStarts: hwStarts,
			headwayBasedEnds: hwEnds,
			headwayBasedHeadways: hwHeadways,
		} = _

		// todo: log errors?
		const serviceId = await svcIdsByTripId.get(tripId)
		if (!serviceId) continue
		const routeId = await routeIdsByTripId.get(tripId)
		if (!routeId) continue
		const days = await services.get(serviceId)
		if (!days) continue

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
}

module.exports = computeStopovers
