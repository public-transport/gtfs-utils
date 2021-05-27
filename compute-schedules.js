'use strict'

const shorthash = require('shorthash').unique

const inMemoryStore = require('./lib/in-memory-store')
const readStopTimes = require('./lib/read-stop-times')

const computeSchedules = async (readFile, filters = {}, opt = {}) => {
	if ('function' !== typeof readFile) {
		throw new Error('readFile must be a function.')
	}

	filters = {
		trip: () => true,
		stopTime: () => true,
		frequenciesRow: () => true,
		...filters,
	}
	if ('function' !== typeof filters.trip) {
		throw new Error('filters.trip must be a function.')
	}
	if ('function' !== typeof filters.stopTime) {
		throw new Error('filters.stopTime must be a function.')
	}
	if ('function' !== typeof filters.frequenciesRow) {
		throw new Error('filters.frequenciesRow must be a function.')
	}

	const {
		createStore,
		computeSig,
	} = {
		createStore: inMemoryStore,
		computeSig: data => shorthash(JSON.stringify(data)),
		...opt,
	}

	const schedules = createStore() // by signature

	for await (const _ of readStopTimes(readFile, filters)) {
		const {
			tripId,
			stops, arrivals: absArrs, departures: absDeps,
			headwayBasedStarts: hwStarts,
			headwayBasedEnds: hwEnds,
			headwayBasedHeadways: hwHeadways,
		} = _

		// make arrivals and departures relative to the first arrival,
		// deduplicate/merge all schedules by signature

		const t0 = absArrs[0]
		const arrs = new Array(absArrs.length)
		const deps = new Array(absDeps.length)
		for (let i = 0; i < absArrs.length; i++) {
			arrs[i] = absArrs[i] === null ? absArrs[i] : absArrs[i] - t0
			deps[i] = absDeps[i] === null ? absDeps[i] : absDeps[i] - t0
		}

		const signature = computeSig([
			stops, arrs, deps,
			hwStarts || [],
			hwEnds || [],
			hwHeadways || [],
		])

		await schedules.map(signature, (schedule) => {
			if (!schedule) { // make a new entry
				return {
					id: signature,
					trips: [{tripId, start: t0}],
					stops,
					arrivals: arrs,
					departures: deps,
					headwayBasedStarts: hwStarts || [],
					headwayBasedEnds: hwEnds || [],
					headwayBasedHeadways: hwHeadways || [],
				}
			}
			// merge into existing schedule
			schedule.trips.push({tripId, start: t0})
			return schedule
		})
	}

	return schedules
}

module.exports = computeSchedules
