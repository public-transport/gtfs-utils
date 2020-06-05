'use strict'

const shorthash = require('shorthash').unique
const recordSort = require('sort-array-by-another')

const parseRelativeTime = require('./lib/parse-relative-time')
const readTrips = require('./read-trips')
const errorsWithRow = require('./lib/errors-with-row')

const noFilters = {
	trip: () => true,
	stopover: () => true
}

const applyStopovers = (trips, readFile, filter) => {
	return new Promise((resolve, reject) => {
		const stopovers = readFile('stop_times')
		stopovers.once('error', (err) => {
			reject(err)
			stopovers.destroy(err)
		})

		stopovers.on('data', errorsWithRow('stop_times', (s) => {

			if (!filter(s)) return null
			const trip = trips[s.trip_id]
			if (!trip) return null // todo: emit error?

			trip.sequence.push(parseInt(s.stop_sequence))
			trip.stops.push(s.stop_id)

			const arr = s.arrival_time ? parseRelativeTime(s.arrival_time) : null
			const dep = s.departure_time ? parseRelativeTime(s.departure_time) : null
			trip.arrivals.push(arr)
			trip.departures.push(dep)
		}))

		stopovers.once('end', (err) => {
			if (err) return reject(err)

			for (let tripId in trips) {
				const trip = trips[tripId]

				// sort stops, arrivals, departures, according to sequence
				const applySort = recordSort(trip.sequence)
				trip.stops = applySort(trip.stops)
				trip.arrivals = applySort(trip.arrivals)
				trip.departures = applySort(trip.departures)

				// make arrivals and departures relative to the first arrival
				const start = trip.arrivals[0]
				const l = trip.arrivals.length
				for (let i = 0; i < l; i++) {
					if (trip.arrivals[i] !== null) trip.arrivals[i] -= start
					if (trip.departures[i] !== null) trip.departures[i] -= start
				}

				// store the start time per trip
				for (let i = 0; i < trip.trips.length; i++) {
					trip.trips[i] = {tripId: trip.trips[i], start}
				}
			}

			setImmediate(resolve, trips)
		})
	})
}

const isObj = o => 'object' === typeof o && o !== null && !Array.isArray(o)

const defComputeSig = (trip) => {
	return shorthash(JSON.stringify([
		trip.stops,
		trip.arrivals,
		trip.departures
	]))
}

const computeSchedules = (readFile, filters = {}, computeSig = defComputeSig) => {
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

	return readTrips(readFile, filters.trip)
	.then((trips) => {
		// Reading all of trips.txt only to throw everything away is ridiculous.
		// todo: find a more efficient way
		for (let tripId in trips) {
			trips[tripId] = {
				id: null, // to be used later
				trips: [tripId],
				sequence: [], // stop_times[].stop_sequence mumbers
				stops: [], // stop IDs
				arrivals: [], // timestamps
				departures: [] // timestamps
			}
		}
		return trips
	})
	.then((trips) => applyStopovers(trips, readFile, filters.stopover))
	.then((trips) => {
		// deduplicate by signature
		const schedules = Object.create(null) // by signature

		for (let tripId in trips) {
			const trip = trips[tripId]
			const signature = computeSig(trip)
			const trip2 = schedules[signature]

			if (trip2) {
				trip2.trips = trip2.trips.concat(trip.trips)
			} else {
				trip.id = signature
				schedules[signature] = trip
			}
		}

		return schedules
	})
}

module.exports = computeSchedules
