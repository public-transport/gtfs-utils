'use strict'

const readServicesAndExceptions = require('./read-services-and-exceptions')
const datesBetween = require('./lib/dates-between')

const WEEKDAYS = [
	// JS Date ordering
	'sunday',
	'monday',
	'tuesday',
	'wednesday',
	'thursday',
	'friday',
	'saturday',
]

const noWeekday = {
	monday: false,
	tuesday: false,
	wednesday: false,
	thursday: false,
	friday: false,
	saturday: false,
	sunday: false,
}

const formatDate = isoDate => isoDate.split('-').join('')

const optimiseServicesAndExceptions = async function* (readFile, timezone, filters = {}, opt = {}) {
	const weekdaysMap = new Map()
	const svcsAndExceptions = readServicesAndExceptions(readFile, timezone, filters, {
		...opt,
		exposeStats: true,
		weekdaysMap,
	})

	for await (let [serviceId, dates, svc, nrOfDates, removedDates] of svcsAndExceptions) {
		const nrOfDefaultDates = []
		for (let wd = 0; wd < WEEKDAYS.length; wd++) {
			const defaultDates = datesBetween(
				svc.start_date, svc.end_date,
				{...noWeekday, [WEEKDAYS[wd]]: true},
				timezone,
				weekdaysMap,
			)
			nrOfDefaultDates[wd] = defaultDates.length
		}

		let changed = false
		svc = {...svc}
		for (let wd = 0; wd < 7; wd++) {
			// todo: make this customisable
			const flag = nrOfDates[wd] > nrOfDefaultDates[wd] / 2 | 0 ? '1' : '0'
			changed = changed || (flag !== svc[WEEKDAYS[wd]])
			svc[WEEKDAYS[wd]] = flag
		}

		const exceptions = []
		for (const date of dates) {
			const wd = weekdaysMap.get(date)
			if (svc[WEEKDAYS[wd]] === '1') continue
			exceptions.push({
				service_id: serviceId,
				date: formatDate(date),
				exception_type: '1', // added
			})
		}

		for (const date of removedDates) {
			const wd = weekdaysMap.get(date)
			if (svc[WEEKDAYS[wd]] === '0') continue
			exceptions.push({
				service_id: serviceId,
				date: formatDate(date),
				exception_type: '2', // removed
			})
		}

		// todo [breaking]: remove serviceId (idx 0), move svc first,
		// follow read-services-and-exceptions here
		yield [serviceId, changed, svc, exceptions]
	}
}

module.exports = optimiseServicesAndExceptions
