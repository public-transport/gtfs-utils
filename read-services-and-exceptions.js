'use strict'

const {eq: arrEq, has: arrHas, add: arrInsert} = require('sorted-array-functions')
const expectSorting = require('./lib/expect-sorting')
const joinIteratively = require('./lib/join-iteratively')
const isNotFoundError = require('./lib/is-not-found-error')
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

	await new Promise(r => setTimeout(r, 0))

	let servicesFileExists = true
	let services = (async function* () {})()
	try {
		services = await readFile('calendar')
	} catch (err) {
		if (err) { // wtf
			if (isNotFoundError(err)) servicesFileExists = false
			else throw err
		}
	}

	let exceptionsFileExists = true
	let exceptions = (async function* () {})()
	try {
		exceptions = await readFile('calendar_dates')
	} catch (err) {
		if (err) { // wtf
			if (isNotFoundError(err)) exceptionsFileExists = false
			else throw err
		}
	}

	if (!servicesFileExists && !exceptionsFileExists) {
		// todo: throw proper error
		throw new Error('Both calendar & calendar_dates are missing, at least one is required.')
	}

	const checkServicesSorting = expectSorting('calendar', (a, b) => {
		if (a.service_id === b.service_id) return 0
		return a.service_id < b.service_id ? -1 : 1
	})
	const checkExceptionsSorting = expectSorting('calendar_dates', (a, b) => {
		if (a.service_id < b.service_id) return -1
		if (a.service_id > b.service_id) return 1
		if (a.date > b.date) return 1
		return a.date < b.date ? -1 : 1
	})

	const matchException = (svc, ex) => {
		if (svc.service_id === ex.service_id) return 0
		return svc.service_id < ex.service_id ? -1 : 1
	}
	const pairs = joinIteratively(matchException, services, exceptions, {
		filterA: serviceFilter,
		filterB: serviceExceptionFilter,
	})

	const {NONE} = joinIteratively
	let serviceId = NaN
	let dates = []

	for await (const [s, ex] of pairs) {
		let _serviceId = NaN
		if (s !== NONE) {
			checkServicesSorting(s)
			_serviceId = s.service_id
		}
		if (ex !== NONE) {
			checkExceptionsSorting(ex)
			_serviceId = ex.service_id
		}

		if (_serviceId !== serviceId) {
			if (dates.length > 0) yield [serviceId, dates]

			serviceId = _serviceId

			if (s !== NONE) {
				dates = datesBetween(
					s.start_date, s.end_date,
					{
						monday: s.monday === '1',
						tuesday: s.tuesday === '1',
						wednesday: s.wednesday === '1',
						thursday: s.thursday === '1',
						friday: s.friday === '1',
						saturday: s.saturday === '1',
						sunday: s.sunday === '1',
					},
					timezone,
				)
			} else {
				dates = []
			}
		}

		if (ex !== NONE) {
			checkServicesSorting(ex)

			const date = parseDate(ex.date)
			if (ex.exception_type === REMOVED) {
				const i = arrEq(dates, date)
				if (i >= 0) {
					dates.splice(i, 1) // delete
				}
			} else if (ex.exception_type === ADDED) {
				if (!arrHas(dates, date)) {
					arrInsert(dates, date)
				}
			} // todo: else emit error
		}
	}
	if (dates.length > 0) yield [serviceId, dates]
}

module.exports = readServicesAndExceptions
