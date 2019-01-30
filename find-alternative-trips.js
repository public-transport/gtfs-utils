'use strict'

const isObj = o => 'object' === typeof o && o !== null && !Array.isArray(o)

const createFindAlternativeTrips = (trips, services, schedules) => {
	if (!isObj(trips)) {
		throw new Error('trips must be an object.')
	}
	if (!isObj(services)) {
		throw new Error('services must be an object.')
	}
	if (!isObj(schedules)) {
		throw new Error('schedules must be an object.')
	}

	const findAlternativeTrips = (fromId, tDep, toId, tArr) => {
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

		const alts = []
		for (const schedId in schedules) {
			const sched = schedules[schedId]

			// Does it run from `fromId` to `toId`?
			const fromI = sched.stops.indexOf(fromId)
			if (fromI === -1) continue
			const toI = sched.stops.indexOf(toId)
			if (toI === -1) continue
			if (toI < fromI) continue

			// Does it take too long?
			const dTDep = sched.departures[fromI]
			const dTArr = sched.arrivals[toI]
			if (dTArr - dTDep > tArr - tDep) continue // todo: add thresold?

			// Does it run at the right point in time?
			// For each trip that follows this schedule, find its service and
			// sort out by absolute departure/arrival times.
			// todo: replace by `for ... of` loop once they're fast enough
			for (let tripRefI = 0; tripRefI < sched.trips.length; tripRefI++) {
				const tripRef = sched.trips[tripRefI]

				const tripId = tripRef.tripId
				const trip = trips[tripId]
				if (!trip) continue // invalid `tripRef.tripId`

				const svcId = trip.service_id
				const svc = services[svcId]
				if (!svc) continue // invalid `trip.service_id`

				// todo: replace by `for ... of` loop once they're fast enough
				for (let svcI = 0; svcI < svc.length; svcI++) {
					const tSvcStart = svc[svcI]

					const tTripStart = tSvcStart + tripRef.start
					const tAltDep = tTripStart + dTDep
					if (tAltDep < tDep) continue // departs too early
					const tAltArr = tTripStart + dTArr
					if (tAltArr > tArr) continue // arrives too late

					alts.push({
						tripId,
						routeId: trip.route_id,
						serviceId: trip.service_id,
						departure: tAltDep,
						arrival: tAltArr
					})
				}
			}
		}
		return alts
	}

	return findAlternativeTrips
}

module.exports = createFindAlternativeTrips
