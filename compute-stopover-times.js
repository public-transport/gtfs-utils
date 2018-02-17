'use strict'

const {PassThrough} = require('stream')
const {DateTime} = require('luxon')
const pump = require('pump')
const through = require('through2')

const daysBetween = require('./lib/days-between')
const parseDate = require('./parse-date')
const parseTime = require('./parse-time')

const isObj = o => 'object' === typeof o && o !== null && !Array.isArray(o)

const noFilters = {
	service: () => true,
	trip: () => true,
	stopover: () => true
}

const readTrips = (data, filter) => {
	return new Promise((resolve, reject) => {
		data.once('error', (err) => {
			data.destroy()
			reject(err)
		})
		data.once('end', () => {
			resolve(acc)
		})

		const acc = Object.create(null) // by ID
		data.on('data', (t) => {
			if (!filter(t)) return null
			acc[t.trip_id] = {serviceId: t.service_id, routeId: t.route_id}
		})
	})
}

const readServices = (data, filter, timezone) => {
	return new Promise((resolve, reject) => {
		data.once('error', (err) => {
			data.destroy()
			reject(err)
		})
		data.once('end', () => {
			resolve(acc)
		})

		const acc = Object.create(null) // by ID
		data.on('data', (s) => {
			if (!filter(s)) return null
			const weekdays = {
				monday: s.monday === '1',
				tuesday: s.tuesday === '1',
				wednesday: s.wednesday === '1',
				thursday: s.thursday === '1',
				friday: s.friday === '1',
				saturday: s.saturday === '1',
				sunday: s.sunday === '1'
			}
			acc[s.service_id] = daysBetween(s.start_date, s.end_date, weekdays, timezone)
		})
	})
}

const applyServiceExceptions = (acc, data, timezone) => {
	return new Promise((resolve, reject) => {
		data.once('error', (err) => {
			data.destroy()
			reject(err)
		})
		data.once('end', () => {
			resolve(acc)
		})

		data.on('data', (s) => {
			const days = acc[s.service_id]
			if (!days) return null

			const day = parseDate(s.date, timezone)
			if (s.exception_type === '2') { // service removed
				const i = days.indexOf(day)
				days.splice(i, 1) // delete
			} else if (s.exception_type === '1') { // service added
				if (!days.includes(day)) days.push(day)
			}
		})
	})
}

// todo: stopover.stop_timezone
const computeStopoverTimes = (data, filters, timezone) => {
	if (!isObj(data)) throw new Error('data must be an object.')
	if (!data.trips) throw new Error('data.trips must be a stream.')
	if (!data.services) throw new Error('data.services must be a stream.')
	if (!data.serviceExceptions) {
		throw new Error('data.serviceExceptions must be a stream.')
	}
	if (!data.stopovers) throw new Error('data.stopovers must be a stream.')

	if (!isObj(filters)) throw new Error('filters must be an object.')
	filters = Object.assign({}, noFilters, filters)
	if ('function' !== typeof filters.service) {
		throw new Error('filters.service must be a function.')
	}
	if ('function' !== typeof filters.trip) {
		throw new Error('filters.trip must be a function.')
	}
	if ('function' !== typeof filters.stopover) {
		throw new Error('filters.stopover must be a function.')
	}

	const out = new PassThrough({ // todo: make this more efficient
		objectMode: true
	})

	Promise.all([
		readServices(data.services, filters.service, timezone)
		.then(s => applyServiceExceptions(s, data.serviceExceptions, timezone)),
		readTrips(data.trips, filters.trip)
	])
	.then(([services, trips]) => {
		let row = 0
		const onStopover = function (s, _, cb) {
			row++
			if (!filters.stopover(s)) return cb()

			const {serviceId, routeId} = trips[s.trip_id]
			const days = services[serviceId]
			if (!days) return cb()

			try {
				for (let day of days) {
					const d = DateTime.fromMillis(day * 1000, {zone: timezone})
					this.push({
						stop_id: s.stop_id,
						trip_id: s.trip_id,
						service_id: serviceId,
						route_id: routeId,
						sequence: s.stop_sequence,
						start_of_trip: day,
						arrival: d.plus(parseTime(s.arrival_time)) / 1000 | 0,
						departure: d.plus(parseTime(s.departure_time)) / 1000 | 0
					})
				}
				cb()
			} catch (err) {
				err.row = row
				err.message += ' – row ' + row
				return cb(err)
			}
		}

		pump(
			data.stopovers,
			through.obj(onStopover),
			out,
			(err) => {
				if (err) out.emit('error', err)
			}
		)
	})
	.catch((err) => {
		out.destroy(err)
	})

	return out
}

module.exports = computeStopoverTimes
