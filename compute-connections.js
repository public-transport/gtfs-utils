'use strict'

const recordSort = require('sort-array-by-another')

const parseRelativeTime = require('./lib/parse-relative-time')
const errorsWithRow = require('./lib/errors-with-row')

const noFilter = () => true

const isObj = o => 'object' === typeof o && o !== null && !Array.isArray(o)

const computeConnections = (readFile, timezone, filter = noFilter) => {
	if ('function' !== typeof readFile) {
		throw new Error('readFile must be a function.')
	}
	if ('string' !== typeof timezone || !timezone) {
		throw new Error('timezone must be a non-empty string.')
	}
	if ('function' !== typeof filter) {
		throw new Error('filter must be a function.')
	}

	const sequences = Object.create(null) // by trip ID
	const stops = Object.create(null) // by trip ID
	const arrivals = Object.create(null) // by trip ID
	const departures = Object.create(null) // by trip ID

	const storeStopover = (s) => {
		if (!filter(s)) return null

		const seq = parseInt(s.stop_sequence)
		const arr = parseRelativeTime(s.arrival_time)
		const dep = parseRelativeTime(s.departure_time)

		if (!sequences[s.trip_id]) {
			sequences[s.trip_id] = [seq]
			stops[s.trip_id] = [s.stop_id]
			arrivals[s.trip_id] = [arr]
			departures[s.trip_id] = [dep]
		} else {
			sequences[s.trip_id].push(seq)
			stops[s.trip_id].push(s.stop_id)
			arrivals[s.trip_id].push(arr)
			departures[s.trip_id].push(dep)
		}
	}

	const sortStopovers = () => {
		for (let t in sequences) {
			const applySort = recordSort(sequences[t])
			sequences[t] = null // allow GC

			stops[t] = applySort(stops[t])
			arrivals[t] = applySort(arrivals[t])
			departures[t] = applySort(departures[t])
		}
	}

	const input = readFile('stop_times')
	input.once('error', (err) => input.destroy(err))
	input.on('data', errorsWithRow('stop_times', storeStopover))

	const generateConnectionsByTripId = function* () {
		const tripIds = Object.keys(sequences)
		const i = tripIds[Symbol.iterator]()

		while (true) {
			const res = i.next()
			if (res.done) return
			const tripId = res.value

			const _stops = stops[tripId]
			const _arrivals = arrivals[tripId]
			const _departures = departures[tripId]

			const connections = []
			for (let i = 1; i < _stops.length; i++) {
				connections.push({
					tripId,
					fromStop: _stops[i - 1],
					departure: _departures[i - 1],
					toStop: _stops[i],
					arrival: _arrivals[i],
				})
			}
			yield connections
		}
	}

	const connections = {}
	connections[Symbol.iterator] = generateConnectionsByTripId

	return new Promise((resolve, reject) => {
		input.once('end', (err) => {
			if (err) return reject(err)
			sortStopovers()
			setImmediate(resolve, connections)
		})
	})
}

module.exports = computeConnections
