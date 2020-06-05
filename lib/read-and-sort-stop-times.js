'use strict'

const recordSort = require('sort-array-by-another')

const parseRelativeTime = require('./parse-relative-time')
const processFile = require('./process-file')

const readAndSortStopTimes = async (readFile, filters, opt) => {
	const {
		createStore,
	} = opt

	const trips = new Set()
	const processTrip = async (t) => {
		if (!filters.trip(t)) return;
		trips.add(t.trip_id)
	}
	await processFile('trips', readFile('trips'), processTrip)

	// This is 1 map `trip ID => {seq, stops, arrivals, departures}`,
	// flattened into 4 maps for memory efficiency.
	const seqsByTripId = createStore()
	const stopsByTripId = createStore()
	const arrsByTripId = createStore()
	const depsByTripId = createStore()

	// collect
	const processStopTime = async (s) => {
		if (!trips.has(s.trip_id) || !filters.stopover(s)) return;

		const seq = parseInt(s.stop_sequence)
		const arr = parseRelativeTime(s.arrival_time)
		const dep = parseRelativeTime(s.departure_time)

		const seqs = await seqsByTripId.get(s.trip_id)
		if (seqs) {
			// update existing entries
			const [stops, arrs, deps] = await Promise.all([
				stopsByTripId.get(s.trip_id),
				arrsByTripId.get(s.trip_id),
				depsByTripId.get(s.trip_id),
			])
			seqs.push(seq)
			stops.push(s.stop_id)
			arrs.push(arr)
			deps.push(dep)
			await Promise.all([
				seqsByTripId.set(s.trip_id, seqs),
				stopsByTripId.set(s.trip_id, stops),
				arrsByTripId.set(s.trip_id, arrs),
				depsByTripId.set(s.trip_id, deps),
			])
		} else {
			// create new entries
			await Promise.all([
				seqsByTripId.set(s.trip_id, [seq]),
				stopsByTripId.set(s.trip_id, [s.stop_id]),
				arrsByTripId.set(s.trip_id, [arr]),
				depsByTripId.set(s.trip_id, [dep]),
			])
		}
	}
	await processFile('stop_times', readFile('stop_times'), processStopTime)

	// sort by sequence nrs
	for await (const [tripId, seqs] of seqsByTripId) {
		const applySort = recordSort(seqs)

		const [stops, arrs, deps] = await Promise.all([
			applySort(await stopsByTripId.get(tripId)),
			applySort(await arrsByTripId.get(tripId)),
			applySort(await depsByTripId.get(tripId)),
		])
		await Promise.all([
			stopsByTripId.set(tripId, applySort(stops)),
			arrsByTripId.set(tripId, applySort(arrs)),
			depsByTripId.set(tripId, applySort(deps)),
		])
	}

	return {
		sequencesByTripId: seqsByTripId,
		stopsByTripId: stopsByTripId,
		arrivalsByTripId: arrsByTripId,
		departuresByTripId: depsByTripId,
	}
}

module.exports = readAndSortStopTimes
