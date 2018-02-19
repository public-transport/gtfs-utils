'use strict'

const {DateTime} = require('luxon')
const recordSort = require('sort-array-by-another')

const parseTime = require('./parse-time')

const noFilter = () => true

const isObj = o => 'object' === typeof o && o !== null && !Array.isArray(o)

// relative to the beginning to the day
const parseTimeRelative = (str) => {
	const t = parseTime(str)
	return t.hours * 3600 + t.minutes * 60 + (t.seconds || 0)
}

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
		const arr = parseTimeRelative(s.arrival_time)
		const dep = parseTimeRelative(s.departure_time)

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
	input.on('data', storeStopover)

	const generateConnections = function* () {
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
					trip_id: tripId,
					from_stop: _stops[i - 1],
					to_stop: _stops[i],
					departure: _departures[i - 1],
					arrival: _arrivals[i]
				})
			}
			yield connections
		}
	}

	const connections = {}
	connections[Symbol.iterator] = generateConnections

	return new Promise((resolve, reject) => {
		input.once('end', (err) => {
			if (err) return reject(err)
			sortStopovers()
			setImmediate(resolve, connections)
		})
	})
}

module.exports = computeConnections
