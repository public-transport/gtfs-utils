'use strict'

const daysBetween = require('./lib/days-between')
const parseDate = require('./parse-date')

const noFilters = {
	service: () => true,
	serviceException: () => true
}

const REMOVED = '2'
const ADDED = '1'

const readServicesAndExceptions = (read, timezone, filters = {}) => {
	// todo: validate args
	filters = Object.assign({}, noFilters, filters)

	const acc = Object.create(null)

	const onService = (s) => {
		if (!filters.service(s)) return null

		const weekdays = {
			monday: s.monday === '1',
			tuesday: s.tuesday === '1',
			wednesday: s.wednesday === '1',
			thursday: s.thursday === '1',
			friday: s.friday === '1',
			saturday: s.saturday === '1',
			sunday: s.sunday === '1'
		}
		const days = daysBetween(s.start_date, s.end_date, weekdays, timezone)
		acc[s.service_id] = days
	}

	const onException = (e) => {
		if (!filters.serviceException(e)) return null

		const days = acc[e.service_id]
		if (!days) return null

		const day = parseDate(e.date, timezone)
		if (e.exception_type === REMOVED) {
			const i = days.indexOf(day)
			days.splice(i, 1) // delete
		} else if (e.exception_type === ADDED) {
			if (!days.includes(day)) days.push(day)
		} // todo: else emit error
	}

	const sortServices = () => {
		for (let id in acc) acc[id] = acc[id].sort()
	}

	return new Promise((resolve, reject) => {
		const services = read('calendar')
		services.on('data', onService)
		services.once('error', () => services.destroy(err))
		services.once('end', (err) => {
			if (err) return reject(err)

			const exceptions = read('calendar_dates')
			exceptions.on('data', onException)
			exceptions.once('error', () => exceptions.destroy(err))
			exceptions.once('end', (err) => {
				if (err) return reject(err)
				sortServices()
				resolve(acc)
			})
		})
	})
}

module.exports = readServicesAndExceptions
