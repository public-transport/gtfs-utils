'use strict'

// const {gte, lte} = require('sorted-array-functions')

const inMemoryStore = require('./lib/in-memory-store')

const computeServiceBreaks = async function* (connections, opt = {}) {
	const {
		createStore,
		minLength,
	} = {
		createStore: inMemoryStore,
		// todo: filters, threshold option, find threshold automatically
		minLength: 10 * 60, // in seconds
		...opt,
	}

	// fromStopId-toStopId => [dep, routeId, serviceId]
	const prevDeps = createStore()

	// todo: handle "breaks" at the beginning of the time frame
	// todo: handle "breaks" at the end of the time frame
	for (let i = 0; i < connections.length; i++) {
		const {
			routeId, serviceId,
			fromStop, toStop, departure,
		} = connections[i]

		const sig = fromStop + '-' + toStop
		const prevDep = await prevDeps.get(sig)

		if (prevDep && (departure - prevDep[0]) >= minLength) {
			// emit service break
			yield {
				fromStop, toStop,
				start: prevDep[0],
				end: departure,
				duration: departure - prevDep[0],
				routeId: prevDep[1],
				serviceId: prevDep[2],
			}
		}

		await prevDeps.set(sig, [
			departure,
			routeId,
			serviceId,
		])
	}
}

module.exports = computeServiceBreaks
