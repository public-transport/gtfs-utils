'use strict'

// Type of the location:
// https://gtfs.org/reference/static/#stopstxt
// - `0` (or blank): Stop (or Platform). A location where passengers board or disembark from a transit vehicle. Is called a platform when defined within a parent_station.
// todo [breaking]: rename to STOP_OR_PLATFORM
const STOP = '0'
// - `1`: Station. A physical structure or area that contains one or more platform.
const STATION = '1'
// - `2`: Entrance/Exit. A location where passengers can enter or exit a station from the street. If an entrance/exit belongs to multiple stations, it can be linked by pathways to both, but the data provider must pick one of them as parent.
// todo [breaking]: rename to ENTRANCE_OR_EXIT
const ENTRANCE_EXIT = '2'
// - `3`: Generic Node. A location within a station, not matching any other location_type, which can be used to link together pathways define in pathways.txt.
const GENERIC_NODE = '3'
// - `4`: Boarding Area. A specific location on a platform, where passengers can board and/or alight vehicles.
const BOARDING_AREA = '4'

module.exports = {
	STOP,
	STATION,
	ENTRANCE_EXIT,
	GENERIC_NODE,
	BOARDING_AREA,
}
