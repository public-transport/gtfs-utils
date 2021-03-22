'use strict'

const debug = require('debug')('gtfs-utils:find-alternative-trips')

const readStopTimezones = require('./lib/read-stop-timezones')
const inMemoryStore = require('./lib/in-memory-store')
const readTrips = require('./read-trips')
const resolveTime = require('./lib/resolve-time')

const isObj = o => 'object' === typeof o && o !== null && !Array.isArray(o)

const createFindAlternativeTrips = async (readFile, timezone, services, schedules) => {
	debug('reading stops.stop_timezone')
	// stop.stop_id -> stop.stop_timezone || parent.stop_timezone
	const stopTimezones = await readStopTimezones(readFile, {
		stop: () => true,
	}, inMemoryStore)

	debug('reading trips')
	const svcIdsRouteIdsByTrip = await readTrips(readFile, {}, {
		formatTrip: t => [t.service_id, t.route_id],
	})

	const findAlternativeTrips = async function* (fromId, tDep, toId, tArr) {
		if ('string' !== typeof fromId || !fromId) {
			throw new Error('fromId must be a non-empty string.')
		}
		if ('number' !== typeof tDep) {
			throw new Error('tDep must be a number.')
		}
		if ('string' !== typeof toId || !toId) {
			throw new Error('toId must be a non-empty string.')
		}
		if ('number' !== typeof tArr) {
			throw new Error('tArr must be a number.')
		}
		if (fromId === toId) {
			throw new Error('fromId and toId must be different.')
		}
		if (tDep >= tArr) throw new Error('tDep must be < tArr.')

		const fromTz = await stopTimezones.get(fromId) || timezone
		const toTz = await stopTimezones.get(toId) || timezone

		for await (const sched of schedules.values()) {
			// Does it run from `fromId` to `toId`?
			const fromI = sched.stops.indexOf(fromId)
			if (fromI === -1) continue
			const toI = sched.stops.indexOf(toId)
			if (toI === -1) continue
			if (toI < fromI) continue

			// Does it take too long?
			const dTDep = sched.departures[fromI]
			const dTArr = sched.arrivals[toI]
			if (dTArr - dTDep > tArr - tDep) continue // todo: add threshold?

			// Does it run at the right point in time?
			// For each trip that follows this schedule, find its service and
			// sort out by absolute departure/arrival times.
			for (const {tripId, start} of sched.trips) {
				const _ = await svcIdsRouteIdsByTrip.get(tripId)
				if (!_) continue // invalid `tripId` or unknwon trip
				const [svcId, routeId] = _
				const dates = await services.get(svcId)
				if (!dates) continue // invalid service ID

				// todo: replace by `for ... of` loop once they're fast enough
				for (let svcI = 0; svcI < dates.length; svcI++) {
					const date = dates[svcI]

					const tAltDep = resolveTime(fromTz, date, start + dTDep)
					if (tAltDep < tDep) continue // departs too early
					const tAltArr = resolveTime(toTz, date, start + dTArr)
					if (tAltArr > tArr) continue // arrives too late

					yield {
						tripId,
						routeId: routeId,
						serviceId: svcId,
						arrival: tAltArr,
						departure: tAltDep
					}
				}
			}
		}
	}

	return findAlternativeTrips
}

module.exports = createFindAlternativeTrips
