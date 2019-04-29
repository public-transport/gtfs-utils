'use strict'

const {gte, lte} = require('sorted-array-functions')

// todo: filters, threshold option, find threshold automatically
const computeServiceBreaks = (connections, minLength = 10 * 60) => {
	// by fromStopId-toStopId
	const breaks = Object.create(null)
	const prevDeps = Object.create(null)

	connections.forEach(({data}) => {
		const sig = data.fromStop + '-' + data.toStop
		const prevDep = sig in prevDeps ? prevDeps[sig] : data.departure

		if (data.departure - prevDep >= minLength) {
			const brk = [
				prevDep,
				data.departure - prevDep,
				data.routeId,
				data.serviceId
			]
			if (!(sig in breaks)) breaks[sig] = []
			breaks[sig].push(brk)
		}
		prevDeps[sig] = data.departure
	})

	const formatBreak = ([from, duration, routeId, serviceId]) => ({
		start: new Date(from * 1000),
		end: new Date((from + duration) * 1000),
		duration, routeId, serviceId
	})

	const findBetween = (from, to, tMin, tMax) => {
		tMin = new Date(tMin) / 1000
		if (Number.isNaN(tMin)) throw new Error('invalid tMin')
		tMax = new Date(tMax) / 1000
		if (Number.isNaN(tMax)) throw new Error('invalid tMax')

		const l = breaks[from + '-' + to]
		if (!l) return []

		const cmp = (a, b) => a[0] - b[0]
		const iMin = gte(l, [tMin], cmp)
		const iMax = lte(l, [tMax], cmp)
		return l.slice(iMin, iMax).map(formatBreak)
	}

	return {data: breaks, findBetween}
}

module.exports = computeServiceBreaks
