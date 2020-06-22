'use strict'

const inMemoryStore = require('./lib/in-memory-store')
const daysBetween = require('./lib/days-between')
const processFile = require('./lib/process-file')
const parseDate = require('./parse-date')

const REMOVED = '2'
const ADDED = '1'

const readServicesAndExceptions = async (readFile, timezone, filters = {}, opt = {}) => {
	// todo: validate args
	const {
		service: serviceFilter,
		serviceException: serviceExceptionFilter,
	} = {
		service: () => true,
		serviceException: () => true,
		...filters
	}
	const {
		createStore,
	} = {
		createStore: inMemoryStore,
		...opt,
	}

	const services = createStore()

	const processService = async (s) => {
		if (!serviceFilter(s)) return;

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
		await services.set(s.service_id, days)
	}

	const processException = async (e) => {
		if (!serviceExceptionFilter(e)) return;

		const days = await services.get(e.service_id)
		if (!days) return;

		const day = parseDate(e.date, timezone)
		if (e.exception_type === REMOVED) {
			const i = days.indexOf(day)
			days.splice(i, 1) // delete
		} else if (e.exception_type === ADDED) {
			if (!days.includes(day)) days.push(day)
		} // todo: else emit error

		await services.set(e.service_id, days)
	}

	await processFile('calendar', readFile('calendar'), processService)
	await processFile('calendar_dates', readFile('calendar_dates'), processException)

	// sort days in services
	for await (const [id, days] of services) {
		days.sort()
		await services.set(id, days)
	}

	return services
}

module.exports = readServicesAndExceptions
