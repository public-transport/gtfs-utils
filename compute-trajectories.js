'use strict'

const debug = require('debug')('gtfs-utils:compute-trajectories')
const {unique: shorthash} = require('shorthash')

const readTrips = require('./read-trips')
const inMemoryStore = require('./lib/in-memory-store')
const {STOP, STATION} = require('./lib/location-types')
const readShapes = require('./read-shapes')
const computeSchedules = require('./compute-schedules')
const buildTrajectory = require('./lib/build-trajectory')

const computeTrajectories = async function* (readFile, filters = {}, opt = {}) {
	if (typeof readFile !== 'function') {
		throw new TypeError('readFile must be a function')
	}
	const {
		stop: stopFilter,
	} = {
		stop: () => true,
		...filters,
	}
	if (typeof stopFilter !== 'function') {
		throw new TypeError('filters.stop must be a function')
	}

	const {
		createStore,
	} = {
		createStore: inMemoryStore,
		...opt,
	}

	debug('reading trips')
	const trips = await readTrips(readFile, filters, {
		...opt,
		formatTrip: t => [t.shape_id, t.service_id],
	})

	debug('reading stop locations')
	const stopLocsById = createStore() // stop ID -> stop location
	for await (const s of await readFile('stops')) {
		if (
			s.location_type !== undefined && s.location_type !== ''
			&& s.location_type !== STOP && s.location_type !== STATION
		) continue
		if (!stopFilter(s)) continue
		const loc = [parseFloat(s.stop_lon), parseFloat(s.stop_lat)]
		await stopLocsById.set(s.stop_id, loc)
	}

	debug('reading shapes')
	const shapesById = createStore() // shape ID -> shape
	// todo: only read shapes that belong to non-filtered trips
	for await (const [shapeId, points] of readShapes(readFile, filters)) {
		await shapesById.set(shapeId, points)
	}

	debug('computing schedules')
	const schedules = await computeSchedules(readFile, filters, opt)

	debug('computing trajectories')
	let i = 0
	for await (const schedule of schedules.values()) {
		if (++i % 100 === 0) debug(i)

		// Taking only the list of stops alon into account wouldn't suffice,
		// as there might be two trips that visit the same stops with vastly
		// different timing. Same with using the list of arrivals/departures only.
		const temporalSig = shorthash(JSON.stringify({
			stops: schedule.stops,
			arrivals: schedule.arrivals,
			departures: schedule.departures,
		}))

		for (const _ of schedule.trips) {
			const {tripId, start: tripStartTime} = _
			const [shapeId, serviceId] = await trips.get(tripId)
			if (!shapeId) {
				// todo: is this a bug?
				debug('missing shape ID for trip ID', tripId)
				continue
			}
			if (!serviceId) {
				debug('missing service ID for trip ID', tripId)
				continue
			}
			const shape = await shapesById.get(shapeId)
			if (!shapeId) {
				// todo: is this a bug?
				debug('missing shape for shape ID', shapeId)
				continue
			}

			// todo: support headway-based (frequencies.txt) trips
			const tr = await buildTrajectory(shapeId, shape, schedule, stopLocsById, tripStartTime)
			tr.properties.tripId = tripId
			tr.properties.serviceId = serviceId
			tr.properties.id = temporalSig + '-' + shapeId
			yield tr
		}
	}
}

module.exports = computeTrajectories
