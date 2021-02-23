'use strict'

const debug = require('debug')('gtfs-utils:compute-sorted-connections')
const {gte} = require('sorted-array-functions')

const inMemoryStore = require('./lib/in-memory-store')
const readTrips = require('./read-trips')
const readServicesAndExceptions = require('./read-services-and-exceptions')
const computeConnections = require('./compute-connections')
const resolveTime = require('./lib/resolve-time')

// todo: respect stopover.stop_timezone & agency.agency_timezone
const computeSortedConnections = async (readFile, timezone, filters = {}, opt = {}) => {
	if ('string' !== typeof timezone || !timezone) {
		throw new Error('timezone must be a non-empty string.')
	}

	const {
		createStore,
	} = {
		createStore: inMemoryStore,
		...opt,
	}

	debug('reading trips')
	const svcIdsRouteIdsByTrip = await readTrips(readFile, filters, {
		...opt,
		formatTrip: t => [t.service_id, t.route_id],
	})

	debug('reading services & exceptions')
	const _services = readServicesAndExceptions(readFile, timezone, filters)
	const services = createStore() // by service ID
	for await (const [id, dates] of _services) {
		await services.set(id, dates)
	}

	// todo: use store API to support memory-constrained environments
	const sortedConnections = []
	const compareConnections = (a, b) => a.departure - b.departure

	debug('reading connections')
	const connectionsByTrip = computeConnections(readFile, filters, opt)
	for await (const connections of connectionsByTrip) {
		if (connections.length === 0) continue

		const _ = await svcIdsRouteIdsByTrip.get(connections[0].tripId)
		if (!_) continue
		const [serviceId, routeId] = _
		const dates = await services.get(serviceId)
		if (!dates) continue // todo: log error?

		for (const c of connections) {
			for (let i = 0; i < dates.length; i++) {
				const dep = resolveTime(timezone, dates[i], c.departure)
				const newCon = {
					tripId: c.tripId,
					serviceId, routeId,
					fromStop: c.fromStop,
					departure: dep,
					toStop: c.toStop,
					arrival: resolveTime(timezone, dates[i], c.arrival),
					headwayBased: !!c.headwayBased,
				}

				const idx = gte(sortedConnections, newCon, compareConnections)
				if (idx === -1) sortedConnections.push(newCon)
				else sortedConnections.splice(idx, 0, newCon)
			}
		}
	}

	return sortedConnections
}

module.exports = computeSortedConnections
