'use strict'

const shorthash = require('shorthash').unique

const processFile = require('./lib/process-file')
const inMemoryStore = require('./lib/in-memory-store')
const readAndSortStopTimes = require('./lib/read-and-sort-stop-times')
const parseRelativeTime = require('./lib/parse-relative-time')
const errorsWithRow = require('./lib/errors-with-row')

const isObj = o => 'object' === typeof o && o !== null && !Array.isArray(o)

const defComputeSig = (data) => {
	return shorthash(JSON.stringify(data))
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

	const {
		sequencesByTripId,
		stopsByTripId,
		arrivalsByTripId,
		departuresByTripId,
	} = await readAndSortStopTimes(readFile, filters, {createStore})

	const schedules = createStore() // by signature

	// make arrivals and departures relative to the first arrival,
	// deduplicate/merge all schedules by signature
	for await (const tripId of sequencesByTripId.keys()) {
		const [stops, absArrs, absDeps] = await Promise.all([
			stopsByTripId.get(tripId),
			arrivalsByTripId.get(tripId),
			departuresByTripId.get(tripId),
		])

		const t0 = absArrs[0]
		const arrs = new Array(absArrs.length)
		const deps = new Array(absDeps.length)
		for (let i = 0; i < absArrs.length; i++) {
			arrs[i] = absArrs[i] === null ? absArrs[i] : absArrs[i] - t0
			deps[i] = absDeps[i] === null ? absDeps[i] : absDeps[i] - t0
		}

		const signature = computeSig([stops, arrs, deps])
		const schedule = await schedules.get(signature)

		if (schedule) { // merge into existing schedule
			schedule.trips.push(tripId)
			await schedules.set(signature, schedule)
		} else { // make a new entry
			await schedules.set(signature, {
				id: signature,
				trips: [tripId],
				stops,
				arrivals: arrs,
				departures: deps,
			})
		}
	}

	return schedules
}

module.exports = computeSchedules
