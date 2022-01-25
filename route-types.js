'use strict'

// https://developers.google.com/transit/gtfs/reference#routestxt
// todo: add descriptions/examples as strings
const basicRouteTypes = [
	// Tram, Streetcar, Light rail. Any light rail or street level system within a metropolitan area.
	{gtfs: 0, fptf: 'train'},
	// Subway, Metro. Any underground rail system within a metropolitan area.
	{gtfs: 1, fptf: 'train'},
	// Rail. Used for intercity or long-distance travel.
	{gtfs: 2, fptf: 'train'},
	// Bus. Used for short- and long-distance bus routes.
	{gtfs: 3, fptf: 'bus'},
	// Ferry. Used for short- and long-distance boat service.
	{gtfs: 4, fptf: 'watercraft'},
	// Cable tram. Used for street-level rail cars where the cable runs beneath the vehicle, e.g., cable car in San Francisco.
	{gtfs: 5, fptf: 'train'},
	// Aerial lift, suspended cable car (e.g., gondola lift, aerial tramway). Cable transport where cabins, cars, gondolas or open chairs are suspended by means of one or more cables.
	{gtfs: 6, fptf: 'gondola'},
	// Funicular. Any rail system designed for steep inclines.
	{gtfs: 7, fptf: 'gondola'},
	// Trolleybus. Electric buses that draw power from overhead wires using poles.
	{gtfs: 11, fptf: 'bus'},
	// Monorail. Railway in which the track consists of a single rail or a beam.
	{gtfs: 12, fptf: 'train'},
]

// https://developers.google.com/transit/gtfs/reference/extended-route-types
// see also https://github.com/google/transit/pull/279
// see also https://bit.ly/gtfs-modes-and-networks
const extendedRouteTypes = [
	// Railway Service
	{gtfs: 100, fptf: 'train'},
	// High Speed Rail Service – TGV (FR), ICE (DE), Eurostar (GB)
	{gtfs: 101, fptf: 'train'},
	// Long Distance Trains – InterCity/EuroCity
	{gtfs: 102, fptf: 'train'},
	// Inter Regional Rail Service – InterRegio (DE), Cross County Rail (GB)
	{gtfs: 103, fptf: 'train'},
	// Car Transport Rail Service
	{gtfs: 104, fptf: 'train'},
	// Sleeper Rail Service – GNER Sleeper (GB)
	{gtfs: 105, fptf: 'train'},
	// Regional Rail Service – TER (FR), Regionalzug (DE)
	{gtfs: 106, fptf: 'train'},
	// Tourist Railway Service – Romney, Hythe & Dymchurch (GB)
	{gtfs: 107, fptf: 'train'},
	// Rail Shuttle (Within Complex) – Gatwick Shuttle (GB), Sky Line (DE)
	{gtfs: 108, fptf: 'train'},
	// Suburban Railway – S-Bahn (DE), RER (FR), S-tog (Kopenhagen)
	{gtfs: 109, fptf: 'train'},
	// Replacement Rail Service
	{gtfs: 110, fptf: 'train'},
	// Special Rail Service
	{gtfs: 111, fptf: 'train'},
	// Lorry Transport Rail Service
	{gtfs: 112, fptf: 'train'},
	// All Rail Services
	{gtfs: 113, fptf: 'train'},
	// Cross-Country Rail Service
	{gtfs: 114, fptf: 'train'},
	// Vehicle Transport Rail Service
	{gtfs: 115, fptf: 'train'},
	// Rack and Pinion Railway – Rochers de Naye (CH), Dolderbahn (CH)
	{gtfs: 116, fptf: 'train'},
	// Additional Rail Service
	{gtfs: 117, fptf: 'train'},
	// Coach Service
	{gtfs: 200, fptf: 'bus'},
	// International Coach Service – EuroLine, Touring
	{gtfs: 201, fptf: 'bus'},
	// National Coach Service – National Express (GB)
	{gtfs: 202, fptf: 'bus'},
	// Shuttle Coach Service – Roissy Bus (FR), Reading-Heathrow (GB)
	{gtfs: 203, fptf: 'bus'},
	// Regional Coach Service
	{gtfs: 204, fptf: 'bus'},
	// Special Coach Service
	{gtfs: 205, fptf: 'bus'},
	// Sightseeing Coach Service
	{gtfs: 206, fptf: 'bus'},
	// Tourist Coach Service
	{gtfs: 207, fptf: 'bus'},
	// Commuter Coach Service
	{gtfs: 208, fptf: 'bus'},
	// All Coach Services
	{gtfs: 209, fptf: 'bus'},
	// Urban Railway Service
	{gtfs: 400, fptf: 'train'},
	// Metro Service – Métro de Paris
	{gtfs: 401, fptf: 'train'},
	// Underground Service – London Underground, U-Bahn
	{gtfs: 402, fptf: 'train'},
	// Urban Railway Service
	{gtfs: 403, fptf: 'train'},
	// All Urban Railway Services
	{gtfs: 404, fptf: 'train'},
	// Monorail
	{gtfs: 405, fptf: 'train'},
	// Bus Service
	{gtfs: 700, fptf: 'bus'},
	// Regional Bus Service – Eastbourne-Maidstone (GB)
	{gtfs: 701, fptf: 'bus'},
	// Express Bus Service – X19 Wokingham-Heathrow (GB)
	{gtfs: 702, fptf: 'bus'},
	// Stopping Bus Service – 38 London: Clapton Pond-Victoria (GB)
	{gtfs: 703, fptf: 'bus'},
	// Local Bus Service
	{gtfs: 704, fptf: 'bus'},
	// Night Bus Service – N prefixed buses in London (GB)
	{gtfs: 705, fptf: 'bus'},
	// Post Bus Service – Maidstone P4 (GB)
	{gtfs: 706, fptf: 'bus'},
	// Special Needs Bus
	{gtfs: 707, fptf: 'bus'},
	// Mobility Bus Service
	{gtfs: 708, fptf: 'bus'},
	// Mobility Bus for Registered Disabled
	{gtfs: 709, fptf: 'bus'},
	// Sightseeing Bus
	{gtfs: 710, fptf: 'bus'},
	// Shuttle Bus – 747 Heathrow-Gatwick Airport Service (GB)
	{gtfs: 711, fptf: 'bus'},
	// School Bus
	{gtfs: 712, fptf: 'bus'},
	// School and Public Service Bus
	{gtfs: 713, fptf: 'bus'},
	// Rail Replacement Bus Service
	{gtfs: 714, fptf: 'bus'},
	// Demand and Response Bus Service
	{gtfs: 715, fptf: 'bus'},
	// All Bus Services
	{gtfs: 716, fptf: 'bus'},
	// Trolleybus Service
	{gtfs: 800, fptf: 'bus'},
	// Tram Service
	{gtfs: 900, fptf: 'train'},
	// City Tram Service
	{gtfs: 901, fptf: 'train'},
	// Local Tram Service – Munich (DE), Brussels (BE), Croydon (GB)
	{gtfs: 902, fptf: 'train'},
	// Regional Tram Service
	{gtfs: 903, fptf: 'train'},
	// Sightseeing Tram Service – Blackpool Seafront (GB)
	{gtfs: 904, fptf: 'train'},
	// Shuttle Tram Service
	{gtfs: 905, fptf: 'train'},
	// All Tram Services
	{gtfs: 906, fptf: 'train'},
	// Water Transport Service
	{gtfs: 1000, fptf: 'watercraft'},
	// Air Service
	{gtfs: 1100, fptf: 'aircraft'},
	// Ferry Service
	{gtfs: 1200, fptf: 'watercraft'},
	// Aerial Lift Service – Telefèric de Montjuïc (ES), Saleve (CH), Roosevelt Island Tramway (US)
	{gtfs: 1300, fptf: 'gondola'},
	// Funicular Service – Rigiblick (Zürich, CH)
	{gtfs: 1400, fptf: 'gondola'},
	// Taxi Service
	{gtfs: 1500, fptf: 'taxi'},
	// Communal Taxi Service – Marshrutka (RU), dolmuş (TR)
	{gtfs: 1501, fptf: 'taxi'},
	// Water Taxi Service
	{gtfs: 1502, fptf: 'watercraft'},
	// Rail Taxi Service
	{gtfs: 1503, fptf: 'taxi'},
	// Bike Taxi Service
	{gtfs: 1504, fptf: 'taxi'},
	// Licensed Taxi Service
	{gtfs: 1505, fptf: 'taxi'},
	// Private Hire Service Vehicle
	{gtfs: 1506, fptf: 'car'},
	// All Taxi Services
	{gtfs: 1507, fptf: 'taxi'},
	// Miscellaneous Service
	{gtfs: 1700, fptf: null},
	// Horse-drawn Carriage
	{gtfs: 1702, fptf: null},
]

const all = [
	...basicRouteTypes,
	...extendedRouteTypes,
]

const extendedToBasic = (extended) => {
	const {fptf} = extendedRouteTypes.find(m => m.gtfs === extended) || {}
	if (!fptf) throw new Error('unknown/invalid extended type')
	const {gtfs} = basicRouteTypes.find(m => m.fptf === fptf) || {}
	return Number.isInteger(gtfs) ? gtfs : null
}

const gtfsToFptf = (gtfsType) => {
	const match = all.find(m => m.gtfs === gtfsType)
	return match ? match.fptf : null
}
const fptfToGtfs = (fptfMode) => {
	const match = all.find(m => m.fptf === fptfMode)
	return match ? match.gtfs : null
}

module.exports = {
	basic: basicRouteTypes,
	extended: extendedRouteTypes,
	all,
	extendedToBasic,
	gtfsToFptf, fptfToGtfs,
}
