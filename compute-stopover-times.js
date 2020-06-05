'use strict'

const {Transform} = require('stream')
const {DateTime} = require('luxon')
const pump = require('pump')

const inMemoryStore = require('./lib/in-memory-store')
const readServicesAndExceptions = require('./read-services-and-exceptions')
const readTrips = require('./read-trips')
const parseTime = require('./parse-time')
const errorsWithRow = require('./lib/errors-with-row')

const isObj = o => 'object' === typeof o && o !== null && !Array.isArray(o)

// todo: stopover.stop_timezone
const computeStopoverTimes = (readFile, filters, timezone, opt = {}) => {
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
		stopover: stopoverFilter,
	} = filters
	const {
		createStore,
	} = {
		createStore: inMemoryStore,
		...opt,
	}

	let services, trips

	const processStopover = (s, _, cb) => {
		;(async () => {
			if (!stopoverFilter(s)) return;

			const t = await trips.get(s.trip_id)
			if (!t) return;
			const [serviceId, routeId] = t
			const days = await services.get(serviceId)
			if (!days) return;

			const arr = parseTime(s.arrival_time)
			const dep = parseTime(s.departure_time)

			for (let day of days) {
				const d = DateTime.fromMillis(day * 1000, {zone: timezone})
				out.push({
					stop_id: s.stop_id,
					trip_id: s.trip_id,
					service_id: serviceId,
					route_id: routeId,
					sequence: s.stop_sequence,
					start_of_trip: day,
					arrival: d.plus(arr) / 1000 | 0,
					departure: d.plus(dep) / 1000 | 0
				})
			}
		})()
		.then(() => cb(), cb)
	}

	const out = new Transform({
		objectMode: true,
		write: errorsWithRow('stop_times', processStopover),
	})

	;(async () => {
		const [_services, _trips] = await Promise.all([
			readServicesAndExceptions(readFile, timezone, filters),
			readTrips(readFile, filters.trip),
		])
		services = _services
		for await (const [id, trip] of _trips) {
			await _trips.set(id, [trip.service_id, trip.route_id])
		}
		trips = _trips

		pump(
			readFile('stop_times'),
			out,
			(err) => {
				if (err) out.destroy(err)
			},
		)
	})()
	.catch((err) => {
		out.destroy(err)
	})
	return out
}

module.exports = computeStopoverTimes
