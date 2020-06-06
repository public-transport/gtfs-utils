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
			seqs[0].push(seq)
			stops[0].push(s.stop_id)
			arrs[0].push(arr)
			deps[0].push(dep)
			await Promise.all([
				seqsByTripId.set(s.trip_id, seqs),
				stopsByTripId.set(s.trip_id, stops),
				arrsByTripId.set(s.trip_id, arrs),
				depsByTripId.set(s.trip_id, deps),
			])
		} else {
			// create new entries
			await Promise.all([
				seqsByTripId.set(s.trip_id, [[seq]]),
				stopsByTripId.set(s.trip_id, [[s.stop_id]]),
				arrsByTripId.set(s.trip_id, [[arr]]),
				depsByTripId.set(s.trip_id, [[dep]]),
			])
		}
	}
	await processFile('stop_times', readFile('stop_times'), processStopTime)

	// sort each "run" by its sequence nrs
	for await (const [tripId, seqs] of seqsByTripId) {
		const [stops, arrs, deps] = await Promise.all([
			await stopsByTripId.get(tripId),
			await arrsByTripId.get(tripId),
			await depsByTripId.get(tripId),
		])
		for (let i = 0; i < seqs.length; i++) {
			const applySort = recordSort(seqs[i])
			stops[i] = applySort(stops[i])
			arrs[i] = applySort(arrs[i])
			deps[i] = applySort(deps[i])
		}
		await Promise.all([
			stopsByTripId.set(tripId, stops),
			arrsByTripId.set(tripId, arrs),
			depsByTripId.set(tripId, deps),
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
			if (!(await headwayStarts.has(tripId))) {
				await Promise.all([
					headwayStarts.set(tripId, [start]),
					headwayEnds.set(tripId, [end]),
					headwayHeadways.set(tripId, [headway]),
				])
			} else {
				const [starts, ends, headways] = await Promise.all([
					headwayStarts.get(tripId),
					headwayEnds.get(tripId),
					headwayHeadways.get(tripId),
				])
				starts.push(start)
				ends.push(end)
				headways.push(headway)
				await Promise.all([
					headwayStarts.set(tripId, starts),
					headwayEnds.set(tripId, ends),
					headwayHeadways.set(tripId, headways),
				])
			}
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

		const [ends, headways] = await Promise.all([
			await headwayEnds.get(tripId),
			await headwayHeadways.get(tripId),
		])
		// todo: remove/flatten overlaps?
		await Promise.all([
			headwayStarts.set(tripId, applySort(starts)),
			headwayEnds.set(tripId, applySort(ends)),
			headwayHeadways.set(tripId, applySort(headways)),
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
