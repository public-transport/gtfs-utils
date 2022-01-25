'use strict'

const isNotFoundError = (err) => (
	err.code === 'ENOENT'
	|| err.code === 'MODULE_NOT_FOUND'
	|| err.notFound === true
	|| err.statusCode === 404
)

module.exports = isNotFoundError
