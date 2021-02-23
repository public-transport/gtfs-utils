'use strict'

const dateFormat = /^\d{8}$/

const parseDate = (str) => {
	if ('string' !== typeof str) throw new Error('str must be a string.')
	if (!dateFormat.test(str)) throw new Error('str must be YYYYMMDD.')

	return `${str.substr(0, 4)}-${str.substr(4, 2)}-${str.substr(6, 2)}`
}

module.exports = parseDate
