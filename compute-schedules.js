'use strict'

const shorthash = require('shorthash').unique
const recordSort = require('sort-array-by-another')

const parseTime = require('./parse-time')
const readTrips = require('./read-trips')

const noFilters = {
	trip: () => true,
	stopover: () => true
}

// relative to the beginning to the day
const parseTimeRelative = (str) => {
	const t = parseTime(str)
	return t.hours * 3600 + t.minutes * 60 + (t.seconds || 0)
}

const applyStopovers = (trips, readFile, filter) => {
	return new Promise((resolve, reject) => {
		const stopovers = readFile('stop_times')
		stopovers.once('error', (err) => {
			reject(err)
			stopovers.destroy(err)
		})

		stopovers.on('data', (s) => {
			if (!filter(s)) return null
			const trip = trips[s.trip_id]
			if (!trip) return null // todo: emit error?

			trip.sequence.push(parseInt(s.stop_sequence))
			trip.stops.push(s.stop_id)

			const arr = s.arrival_time ? parseTimeRelative(s.arrival_time) : null
			const dep = s.departure_time ? parseTimeRelative(s.departure_time) : null
			trip.arrivals.push(arr)
			trip.departures.push(dep)
		})

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
					trip.trips[trip.trips[i]] = start
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
	filters = Object.assign({}, noFilters, filters)
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
				signature: null, // to be used later
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
				trip.signature = signature
				schedules[signature] = trip
			}
		}

		return schedules
	})
}

module.exports = computeSchedules
