'use strict'

const {eq: arrEq, has: arrHas, add: arrInsert} = require('sorted-array-functions')
const expectSorting = require('./lib/expect-sorting')
const iterateMatching = require('./lib/iterate-matching')
const datesBetween = require('./lib/dates-between')
const parseDate = require('./lib/parse-date')

const REMOVED = '2'
const ADDED = '1'

const readServicesAndExceptions = async function* (readFile, timezone, filters = {}, opt = {}) {
	if (typeof readFile !== 'function') {
		throw new TypeError('readFile must be a function')
	}

	if ('string' !== typeof timezone || !timezone) {
		throw new Error('timezone must be a non-empty string.')
	}

	const {
		service: serviceFilter,
		serviceException: serviceExceptionFilter,
	} = {
		service: () => true,
		serviceException: () => true,
		...filters
	}
	if (typeof serviceFilter !== 'function') {
		throw new TypeError('filters.service must be a function')
	}
	if (typeof serviceExceptionFilter !== 'function') {
		throw new TypeError('filters.serviceException must be a function')
	}

	const services = await readFile('calendar')
	const checkServicesSorting = expectSorting('calendar', (a, b) => {
		if (a.service_id === b.service_id) return 0
		return a.service_id < b.service_id ? -1 : 1
	})

	const exceptions = await readFile('calendar_dates')
	const compareException = (svc, ex) => {
		if (svc.service_id === ex.service_id) return 0
		return svc.service_id < ex.service_id ? -1 : 1
	}
	const matchingExceptions = iterateMatching(compareException, exceptions)
	const checkExceptionsSorting = expectSorting('calendar_dates', (a, b) => {
		if (a.service_id < b.service_id) return -1
		if (a.service_id > b.service_id) return 1
		if (a.date > b.date) return 1
		return a.date < b.date ? -1 : 1
	})

	for await (const s of services) {
		if (!serviceFilter(s)) continue
		checkServicesSorting(s)

		const dates = datesBetween(s.start_date, s.end_date, {
			monday: s.monday === '1',
			tuesday: s.tuesday === '1',
			wednesday: s.wednesday === '1',
			thursday: s.thursday === '1',
			friday: s.friday === '1',
			saturday: s.saturday === '1',
			sunday: s.sunday === '1',
		}, timezone)

		for await (const ex of matchingExceptions(s)) {
			if (!serviceExceptionFilter(ex)) continue
			checkExceptionsSorting(ex)

			const date = parseDate(ex.date)
			if (ex.exception_type === REMOVED) {
				const i = arrEq(dates, date)
				if (i >= 0) dates.splice(i, 1) // delete
			} else if (ex.exception_type === ADDED) {
				if (!arrHas(dates, date)) arrInsert(dates, date)
			} // todo: else emit error
		}

		yield [s.service_id, dates]
	}
}

module.exports = readServicesAndExceptions
