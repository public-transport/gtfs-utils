'use strict'

const {gte} = require('sorted-array-functions')
const expectSorting = require('./expect-sorting')
const iterateMatching = require('./iterate-matching')
const parseTimeAsMs = require('./parse-time-as-milliseconds')
const isNotFoundError = require('./is-not-found-error')

// see also https://gist.github.com/derhuerst/574edc94981a21ef0ce90713f1cff7f6

const insertAt = (list, i, val) => {
	if (i === -1) list.push(val)
	else list.splice(i, 0, val)
}

const readStopTimes = async function* (readFile, filters) {
	const {
		trip: tripFilter,
		stopTime: stopTimeFilter,
		frequenciesRow: frequenciesFilter,
	} = filters

	// todo: DRY with read-trips.js

	const trips = await readFile('trips')
	const checkTripsSorting = expectSorting('trips', (a, b) => {
		if (a.trip_id === b.trip_id) return 0
		return a.trip_id < b.trip_id ? -1 : 1
	})

	const stopTimes = await readFile('stop_times')
	const compareStopTimes = (trip, stopTime) => {
		if (trip.trip_id === stopTime.trip_id) return 0
		return trip.trip_id < stopTime.trip_id ? -1 : 1
	}
	const matchingStopTimes = iterateMatching(compareStopTimes, stopTimes)
	const checkStopTimesSorting = expectSorting('stop_times', (a, b) => {
		if (a.trip_id < b.trip_id) return -1
		if (a.trip_id > b.trip_id) return 1
		// todo: validate
		const seqA = parseInt(a.stop_sequence)
		const seqB = parseInt(b.stop_sequence)
		if (seqA === seqB) return 0
		return seqA < seqB ? -1 : 1
	})

	// Try to read frequencies.txt, fall back to empty async iterator.
	let matchingFrequencies = () => ({
		[Symbol.asyncIterator]: async function* () {},
	})
	try {
		const frequencies = await readFile('frequencies')
		const compareFrequencies = (trip, freq) => {
			if (trip.trip_id === freq.trip_id) return 0
			return trip.trip_id < freq.trip_id ? -1 : 1
		}
		matchingFrequencies = iterateMatching(compareFrequencies, frequencies)
	} catch (err) {
		if (err && !isNotFoundError(err)) throw err
	}
	const checkFrequenciesSorting = expectSorting('frequencies', (a, b) => {
		if (a.trip_id < b.trip_id) return -1
		if (a.trip_id > b.trip_id) return 1
		// todo: validate
		const startA = parseTimeAsMs(a.start_time)
		const startB = parseTimeAsMs(b.start_time)
		if (startA === startB) return 0
		return startA < startB ? -1 : 1
	})

	for await (const t of trips) {
		if (!tripFilter(t)) continue
		checkTripsSorting(t)

		const seqs = [[]]
		const stops = [[]]
		const arrs = [[]]
		const deps = [[]]
		const hwStarts = []
		const hwEnds = []
		const hwHeadways = []

		for await (const s of matchingStopTimes(t)) {
			// todo: filtering here breaks frequencies.txt,
			// because it needs the the first stop_time of the trip
			if (!stopTimeFilter(s)) continue
			checkStopTimesSorting(s)

			const seq = parseInt(s.stop_sequence)
			const arr = parseTimeAsMs(s.arrival_time)
			const dep = parseTimeAsMs(s.departure_time)

			const i = gte(seqs[0], seq)
			insertAt(seqs[0], i, seq)
			insertAt(stops[0], i, s.stop_id)
			insertAt(arrs[0], i, arr)
			insertAt(deps[0], i, dep)
		}

		try {
		for await (const f of matchingFrequencies(t)) {
			if (!frequenciesFilter(f)) continue
			checkFrequenciesSorting(f)

			const start = parseTimeAsMs(f.start_time)
			const end = parseTimeAsMs(f.end_time)
			const headway = parseInt(f.headway_secs)

			// Frequency-based service in which service does not follow a fixed
			// schedule throughout the day. Instead, operators attempt to
			// strictly maintain predetermined headways for trips.
			if (!f.exact_times || f.exact_times === '0') {
				const i = gte(hwStarts, start)
				insertAt(hwStarts, i, start)
				insertAt(hwEnds, i, end)
				insertAt(hwHeadways, i, headway)
			// A compressed representation of schedule-based service that has
			// the exact same headway for trips over specified time period(s).
			// In schedule-based service operators try to strictly adhere to a
			// schedule.
			} else {
				// compute arrivals & departures
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

				// insert new stops, arrivals & departures
				const i = gte(arrs, newArrs, (a, b) => a[0] - b[0])
				insertAt(stops, i, newStops)
				insertAt(arrs, i, newArrs)
				insertAt(deps, i, newDeps)
			}
		}
		} catch (err) {
			if (err && !isNotFoundError(err)) throw err
		}

		yield {
			tripId: t.trip_id,
			routeId: t.route_id,
			serviceId: t.service_id,
			shapeId: t.shape_id,
			stops: stops.flat(),
			arrivals: arrs.flat(),
			departures: deps.flat(),
			headwayBasedStarts: hwStarts,
			headwayBasedEnds: hwEnds,
			headwayBasedHeadways: hwHeadways,
		}
	}
}

module.exports = readStopTimes
