'use strict'

const shorthash = require('shorthash').unique
const recordSort = require('sort-array-by-another')

const processFile = require('./lib/process-file')
const parseRelativeTime = require('./lib/parse-relative-time')
const inMemoryStore = require('./lib/in-memory-store')
const readTrips = require('./read-trips')
const errorsWithRow = require('./lib/errors-with-row')

const isObj = o => 'object' === typeof o && o !== null && !Array.isArray(o)

const defComputeSig = (trip) => {
	return shorthash(JSON.stringify([
		trip.stops,
		trip.arrivals,
		trip.departures
	]))
}

const computeSchedules = async (readFile, filters = {}, opt = {}) => {
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
		createStore,
		computeSig,
	} = {
		createStore: inMemoryStore,
		computeSig: defComputeSig,
		...opt,
	}

	// read all trip IDs into a schedule "skeletons"
	const trips = createStore() // by signature
	const processTrip = async (t) => {
		if (!filters.trip(t)) return;

		await trips.set(t.trip_id, {
			id: null, // to be used later
			trips: [t.trip_id],
			sequence: [], // stop_times[].stop_sequence mumbers
			stops: [], // stop IDs
			arrivals: [], // timestamps
			departures: [] // timestamps
		})
	}
	await processFile('trips', readFile('trips'), processTrip)

	// apply stop_times to the schedule "skeletons"
	const processStopover = async (s) => {
		if (!filters.stopover(s)) return;
		const trip = await trips.get(s.trip_id)
		if (!trip) return null // todo: emit error?

		const arr = s.arrival_time ? parseRelativeTime(s.arrival_time) : null
		const dep = s.departure_time ? parseRelativeTime(s.departure_time) : null

		trip.sequence.push(parseInt(s.stop_sequence))
		trip.stops.push(s.stop_id)
		trip.arrivals.push(arr)
		trip.departures.push(dep)

		await trips.set(s.trip_id, trip)
	}
	await processFile('stop_times', readFile('stop_times'), processStopover)

	// sort & normalize the schedule "skeletons"
	for await (const [id, trip] of trips) {
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

		await trips.set(id, trip)
	}

	// deduplicate/merge all "skeletons" by signature
	const schedules = createStore() // by signature
	for await (const [id, trip] of trips) {
		const signature = computeSig(trip)
		const trip2 = await schedules.get(signature)

		if (trip2) { // merge trip into trip2
			trip2.trips = trip2.trips.concat(trip.trips)
			await schedules.set(signature, trip2)
		} else { // make a new entry
			trip.id = signature
			await trips.set(id, trip)
			await schedules.set(signature, trip)
		}
	}

	return schedules
}

module.exports = computeSchedules
