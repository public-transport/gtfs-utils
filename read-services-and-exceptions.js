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

	const {
		exposeStats,
		weekdaysMap,
	} = {
		exposeStats: false,
		weekdaysMap: new Map(),
		...opt,
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

	const weekdayOf = (date) => {
		if (weekdaysMap.has(date)) return weekdaysMap.get(date)
		const weekday = new Date(date + 'T00:00Z').getDay()
		weekdaysMap.set(date, weekday)
		return weekday
	}

	const {NONE} = joinIteratively
	let dates = []
	let svc = {service_id: NaN}
	// todo: default to null? perf?
	let nrOfDates = new Array(7).fill(0)
	let removedDates = []

	for await (const [s, ex] of pairs) {
		let _svc = {service_id: NaN}
		if (ex !== NONE) {
			checkExceptionsSorting(ex)
			_svc = {
				service_id: ex.service_id,
				monday: '0',
				tuesday: '0',
				wednesday: '0',
				thursday: '0',
				friday: '0',
				saturday: '0',
				sunday: '0',
				start_date: null, end_date: null,
			}
		}
		if (s !== NONE) {
			checkServicesSorting(s)
			_svc = s
		}

		if (_svc.service_id !== svc.service_id) {
			// todo [breaking]: remove serviceId (idx 0), move svc first
			if (dates.length > 0) {
				if (svc.start_date === null) svc.start_date = dates[0]
				if (svc.end_date === null) svc.end_date = dates[dates.length - 1]
				yield [svc.service_id, dates, svc, nrOfDates, removedDates]
			}

			svc = _svc

			if (s !== NONE) {
				const wdm = exposeStats ? weekdaysMap : null
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
					wdm,
				)
			} else {
				dates = []
			}

			if (exposeStats) {
				nrOfDates = new Array(7).fill(0)
				for (const date of dates) {
					nrOfDates[weekdayOf(date)]++
				}
				removedDates = []
			}
		}

		if (ex !== NONE) {
			checkServicesSorting(ex)

			const date = parseDate(ex.date)
			if (ex.exception_type === REMOVED) {
				const i = arrEq(dates, date)
				if (i >= 0) {
					dates.splice(i, 1) // delete
					if (exposeStats) {
						nrOfDates[weekdayOf(date)]--
						removedDates.push(date)
					}
				}
			} else if (ex.exception_type === ADDED) {
				if (!arrHas(dates, date)) {
					arrInsert(dates, date)
					if (exposeStats) {
						nrOfDates[weekdayOf(date)]++
					}
				}
			} // todo: else emit error
		}
	}
	// todo [breaking]: remove serviceId (idx 0), move svc first
	if (dates.length > 0) {
		if (svc.start_date === null) svc.start_date = dates[0]
		if (svc.end_date === null) svc.end_date = dates[dates.length - 1]
		yield [svc.service_id, dates, svc, nrOfDates, removedDates]
	}
}

module.exports = readServicesAndExceptions
