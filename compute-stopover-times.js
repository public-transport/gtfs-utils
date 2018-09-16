'use strict'

const {PassThrough} = require('stream')
const {DateTime} = require('luxon')
const pump = require('pump')
const through = require('through2')

const readServicesAndExceptions = require('./read-services-and-exceptions')
const readTrips = require('./read-trips')
const parseTime = require('./parse-time')
const errorsWithRow = require('./lib/errors-with-row')

const isObj = o => 'object' === typeof o && o !== null && !Array.isArray(o)

const noFilters = {
	service: () => true,
	trip: () => true,
	stopover: () => true
}

// todo: stopover.stop_timezone
const computeStopoverTimes = (readFile, filters, timezone) => {
	if ('function' !== typeof readFile) {
		throw new Error('readFile must be a function.')
	}

	if (!isObj(filters)) throw new Error('filters must be an object.')
	filters = Object.assign({}, noFilters, filters)
	if ('function' !== typeof filters.service) {
		throw new Error('filters.service must be a function.')
	}
	if ('function' !== typeof filters.trip) {
		throw new Error('filters.trip must be a function.')
	}
	if ('function' !== typeof filters.stopover) {
		throw new Error('filters.stopover must be a function.')
	}

	let services, trips

	const onStopover = function (s, _, cb) {
		if (!filters.stopover(s)) return cb()

		const {serviceId, routeId} = trips[s.trip_id]
		const days = services[serviceId]
		if (!days) return cb()

		const arr = parseTime(s.arrival_time)
		const dep = parseTime(s.departure_time)

		for (let day of days) {
			const d = DateTime.fromMillis(day * 1000, {zone: timezone})
			this.push({
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
		cb()
	}

	const parser = through.obj(errorsWithRow('stop_times', onStopover))

	Promise.all([
		readServicesAndExceptions(readFile, timezone, filters),
		readTrips(readFile, filters.trip)
	])
	.then(([_services, _trips]) => {
		services = _services
		for (let tripId in _trips) {
			_trips[tripId] = {
				serviceId: _trips[tripId].service_id,
				routeId: _trips[tripId].route_id
			}
		}
		trips = _trips

		pump(
			readFile('stop_times'),
			parser,
			() => {}
		)
	})
	.catch((err) => {
		parser.destroy(err)
	})

	return parser
}

module.exports = computeStopoverTimes
