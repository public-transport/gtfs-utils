'use strict'

const {Readable} = require('stream')
const {DateTime} = require('luxon')

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
			acc[t.trip_id] = t.service_id
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

	const out = new Readable({
		objectMode: true, read: () => {}
	})

	Promise.all([
		readServices(data.services, filters.service, timezone)
		.then(s => applyServiceExceptions(s, data.serviceExceptions, timezone)),
		readTrips(data.trips, filters.trip)
	])
	.then(([services, serviceIdsByTripId]) => {
		const s = data.stopovers
		s.once('error', (err) => {
			s.destroy()
			out.destroy(err)
		})
		s.once('end', () => {
			out.push(null) // end
		})

		s.on('data', (s) => {
			if (!filters.stopover(s)) return null

			const serviceId = serviceIdsByTripId[s.trip_id]
			const days = services[serviceId]
			if (!days) return null

			for (let day of days) {
				day = DateTime.fromMillis(day * 1000, {zone: timezone})
				out.push({
					stop_id: s.stop_id,
					trip_id: s.trip_id,
					service_id: serviceId,
					sequence: s.stop_sequence,
					arrival: day.plus(parseTime(s.arrival_time)) / 1000 | 0,
					departure: day.plus(parseTime(s.departure_time)) / 1000 | 0
				})
			}
		})
	})
	.catch((err) => {
		out.destroy(err)
	})

	return out
}

module.exports = computeStopoverTimes
