'use strict'

const recordSort = require('sort-array-by-another')

const parseRelativeTime = require('./parse-relative-time')
const processFile = require('./process-file')

// see also https://gist.github.com/derhuerst/574edc94981a21ef0ce90713f1cff7f6

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
	// flattened into 4 maps for memory efficiency. Later, it will be
	// transformed to `trip ID => [{seq, stops, arrivals, departures}]`.
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
			seqs.push(seq)
			await Promise.all([
				seqsByTripId.set(s.trip_id, seqs),
				stopsByTripId.map(s.trip_id, (stops) => {
					stops.push(s.stop_id)
					return stops
				}),
				arrsByTripId.map(s.trip_id, (arrs) => {
					arrs.push(arr)
					return arrs
				}),
				depsByTripId.map(s.trip_id, (deps) => {
					deps.push(dep)
					return deps
				}),
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

	// sort by sequence nrs, prepare for >1 "runs"
	for await (const [tripId, seqs] of seqsByTripId) {
		const applySort = recordSort(seqs)
		await Promise.all([
			// note that we wrap in an array here
			seqsByTripId.set(tripId, [applySort(seqs)]),
			stopsByTripId.map(tripId, stops => [applySort(stops)]),
			arrsByTripId.map(tripId, arrs => [applySort(arrs)]),
			depsByTripId.map(tripId, deps => [applySort(deps)]),
		])
	}

	const headwayStarts = createStore()
	const headwayEnds = createStore()
	const headwayHeadways = createStore()

	const processFreqRow = async (f) => {
		if (!trips.has(f.trip_id) || !filters.frequenciesRow(f)) return;

		const tripId = f.trip_id
		const start = parseRelativeTime(f.start_time)
		const end = parseRelativeTime(f.end_time)
		const headway = parseInt(f.headway_secs)

		if (!f.exact_times || f.exact_times === '0') {
			// Frequency-based service in which service does not follow a fixed
			// schedule throughout the day. Instead, operators attempt to
			// strictly maintain predetermined headways for trips.
			await Promise.all([
				headwayStarts.map(tripId, (starts) => {
					if (!starts) return [start]
					starts.push(start)
					return starts
				}),
				headwayEnds.map(tripId, (ends) => {
					if (!ends) return [end]
					ends.push(end)
					return ends
				}),
				headwayHeadways.map(tripId, (headways) => {
					if (!headways) return [headway]
					headways.push(headway)
					return headways
				}),
			])
		} else if (f.exact_times === '1') {
			// A compressed representation of schedule-based service that has
			// the exact same headway for trips over specified time period(s).
			// In schedule-based service operators try to strictly adhere to a
			// schedule.
			const [stops, arrs, deps] = await Promise.all([
				stopsByTripId.get(tripId),
				arrsByTripId.get(tripId),
				depsByTripId.get(tripId),
			])

			const t0 = arrs[0][0]
			const l = stops[0].length
			const newStops = Array.from(stops[0])
			const newArrs = new Array(l)
			const newDeps = new Array(l)
			for (let t = start; t < end; t += headway) {
				for (let i = 0; i < l; i++) {
					newArrs[i] = t + arrs[0][i] - t0
					newDeps[i] = t + deps[0][i] - t0
				}
			}

			stops.push(newStops)
			arrs.push(newArrs)
			deps.push(newDeps)
			await Promise.all([
				stopsByTripId.set(tripId, stops),
				arrsByTripId.set(tripId, arrs),
				depsByTripId.set(tripId, deps),
			])
		}
	}
	try {
		await processFile('frequencies', readFile('frequencies'), processFreqRow)
	} catch (err) {
		// ignore error if file does not exist
		if (
			err
			&& err.code !== 'ENOENT'
			&& err.code !== 'MODULE_NOT_FOUND'
			&& err.notFound !== true
		) throw err
	}

	// sort headway-based time frames by start time
	for await (const [tripId, starts] of headwayStarts) {
		const applySort = recordSort(starts)
		// todo: remove/flatten overlaps?
		await Promise.all([
			headwayStarts.set(tripId, applySort(starts)),
			headwayEnds.map(tripId, ends => applySort(ends)),
			headwayHeadways.map(tripId, headways => applySort(headways)),
		])
	}

	// sort "runs" by their start time, join/flatten them
	for await (const tripId of stopsByTripId.keys()) {
		let [stops, arrs, deps] = await Promise.all([
			await stopsByTripId.get(tripId),
			await arrsByTripId.get(tripId),
			await depsByTripId.get(tripId),
		])

		const applySort = recordSort(arrs, (a, b) => a[0] - b[0])
		stops = applySort(stops).flat()
		arrs = applySort(arrs).flat()
		deps = applySort(deps).flat()

		await Promise.all([
			stopsByTripId.set(tripId, stops),
			arrsByTripId.set(tripId, arrs),
			depsByTripId.set(tripId, deps),
		])
	}

	return {
		stopsByTripId: stopsByTripId,
		arrivalsByTripId: arrsByTripId,
		departuresByTripId: depsByTripId,
		headwayBasedStarts: headwayStarts,
		headwayBasedEnds: headwayEnds,
		headwayBasedHeadways: headwayHeadways,
	}
}

module.exports = readAndSortStopTimes
