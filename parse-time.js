'use strict'

const timeFormat = /^\d{1,3}:\d{2}(:\d{2})?$/

const parseTime = (str) => {
	if ('string' !== typeof str) throw new Error('str must be a string.')
	if (!timeFormat.test(str)) throw new Error('str must be (h)hh:mm(:ss).')

	const t = str.split(':')
	return {
		hours: parseInt(t[0]),
		minutes: parseInt(t[1]),
		seconds: t[2] ? parseInt(t[2]) : null
	}
}

module.exports = parseTime
