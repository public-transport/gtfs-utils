#!/bin/bash

set -e
set -o pipefail

function sort() {
	if [ -f "$1.csv" ]; then local file="$1.csv"
	elif [ -f "$1.txt" ]; then local file="$1.txt"
	else return 0
	fi
	2>&1 echo "$ mlr --csv sort ${@:2} $file"
	mlr --csv sort ${@:2} "$file" | sponge "$file"
}

sort agency -f agency_id
# For stations (loc_type 1), parent_station must be empty.
# We get stations first by sorting on parent_station.
sort stops -f parent_station -nr location_type
sort routes -f route_id
sort trips -f trip_id
sort stop_times -f trip_id -n stop_sequence
sort calendar -f service_id
sort calendar_dates -f service_id,date
sort shapes -f shape_id -n shape_pt_sequence
# todo: sort start_time properly (it may be HH:MM:SS or H:MM:SS)
sort frequencies -f trip_id,start_time
