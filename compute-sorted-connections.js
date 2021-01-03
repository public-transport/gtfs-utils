'use strict'

const debug = require('debug')('gtfs-utils:compute-sorted-connections')
const {Writable, pipeline} = require('stream')
const {DateTime} = require('luxon')

const readServicesAndExceptions = require('./read-services-and-exceptions')
const readTrips = require('./read-trips')
const parseTime = require('./parse-time')

const isObj = o => 'object' === typeof o && o !== null && !Array.isArray(o)

const computeStopoversByTrip = (readFile, filters, timezone) => {
	const {
		stopover: stopoverFilter,
	} = filters

	return Promise.all([
		readServicesAndExceptions(readFile, timezone, filters),
		readTrips(readFile, filters.trip)
	])
	.then(([services, trips]) => {
		for (let tripId in trips) {
			trips[tripId] = {
				serviceId: trips[tripId].service_id,
				routeId: trips[tripId].route_id
			}
		}

		const stopovers = Object.create(null) // by trip ID
		const onStopover = (s) => {
			if (!stopoverFilter(s)) return;

			const trip = trips[s.trip_id]
			if (!trip) {
				debug('unknown trip', s.trip_id)
				return;
			}
			const days = services[trip.serviceId]
			if (!days) {
				debug('unknown service', trip.serviceId)
				return;
			}

			s.service_id = trip.serviceId
			s.route_id = trip.routeId
			s.stop_sequence = parseInt(s.stop_sequence)

			if (!(s.trip_id in stopovers)) stopovers[s.trip_id] = [s]
			else stopovers[s.trip_id].push(s)
		}

		let row = 0
		const parser = new Writable({
			objectMode: true,
			write: function parseStopover (s, _, cb) {
				row++
				try {
					onStopover(s)
				} catch (err) {
					err.row = row
					err.message += ' – row ' + row
					return cb(err)
				}
				cb()
			},
			writev: function parseStopovers (chunks, _, cb) {
				for (let i = 0; i < chunks.length; i++) {
					const s = chunks[i].chunk
					row++
					try {
						onStopover(s)
					} catch (err) {
						err.row = row
						err.message += ' – row ' + row
						return cb(err)
					}
				}
				cb()
			}
		})

		return new Promise((resolve, reject) => {
			pipeline(
				readFile('stop_times'),
				parser,
				(err) => {
					if (err) reject(err)
					else resolve({stopovers, trips, services})
				}
			)
		})
	})
}

const sortStopovers = (s1, s2) => s1.stop_sequence - s2.stop_sequence

const computeSortedConnections = (readFile, filters, timezone) => {
	if ('function' !== typeof readFile) {
		throw new Error('readFile must be a function.')
	}

	if (!isObj(filters)) throw new Error('filters must be an object.')
	filters = {
		service: () => true,
		trip: () => true,
		stopover: () => true,
		...filters,
	}
	if ('function' !== typeof filters.service) {
		throw new Error('filters.service must be a function.')
	}
	if ('function' !== typeof filters.trip) {
		throw new Error('filters.trip must be a function.')
	}
	if ('function' !== typeof filters.stopover) {
		throw new Error('filters.stopover must be a function.')
	}

	return computeStopoversByTrip(readFile, filters, timezone)
	.then(({stopovers: allStopovers, trips, services}) => {
		const byDeparture = []

		for (const tripId in allStopovers) {
			const stopovers = allStopovers[tripId].sort(sortStopovers)
			allStopovers[tripId] = null // allow GC

			const {serviceId, routeId} = trips[tripId]
			const days = services[serviceId]

			for (let i = 0; i < days.length; i++) {
				const day = DateTime.fromMillis(days[i] * 1000, {zone: timezone})

				const maxJ = stopovers.length - 1
				for (let j = 0; j < maxJ; j++) {
					const s1 = stopovers[j]
					const s2 = stopovers[j + 1]

					const dep = day.plus(parseTime(s1.departure_time)) / 1000 | 0
					byDeparture.push([dep, {
						tripId,
						fromStop: s1.stop_id,
						departure: dep,
						toStop: s2.stop_id,
						arrival: day.plus(parseTime(s2.arrival_time)) / 1000 | 0,
						routeId,
						serviceId
					}])
				}
			}
		}

		byDeparture.sort((a, b) => a[0] - b[0])
		for (let i = 0; i < byDeparture.length; i++) {
			byDeparture[i] = byDeparture[i][1]
		}
		return byDeparture
	})
}

module.exports = computeSortedConnections
