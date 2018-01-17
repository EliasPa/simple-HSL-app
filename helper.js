function makeQuery(data) {
    var now = new Date();
    var time = now.toString().split(' ')[4];

    var month = (now.getMonth() + 1).toString();
    if (month.length == 1) month = '0' + month;

    var d = now.getDate().toString();
    if (d.length == 1) d = '0' + d;

    var year = now.getFullYear();
    var date = "" + year + "-" + month + "-" + d;

    var from = data.start_coord;
    var to = data.end_coord;

    var fromPlace = data.start;
    var toPlace = data.end;

    var query = `{
        plan(
        fromPlace: "` + fromPlace + `",
        from: {lat: ` + from.lat + `, lon: ` + from.lon + `},
        toPlace: "` + toPlace + `",
        to: {lat: ` + to.lat + `, lon: ` + to.lon + `},
        date: "` + date + `",
        time: "` + time + `"
        numItineraries: 1,
        modes: "BUS,WALK",
        walkReluctance: 2.1,
        walkBoardCost: 600,
        minTransferTime: 600,
        walkSpeed: 1.7,
        ) {
        itineraries{
            walkDistance,
            duration,
            legs {
                mode
                route {
                    shortName
                }
                startTime
                endTime
                from {
                    lat
                    lon
                    name
                    stop {
                        code
                        name
                    }
                },
                to {
                    lat
                    lon
                    name
                },
                agency {
                    id
                },
                distance
                legGeometry {
                    length
                    points
                }
            }
        }
        }
    }`

    return query;
}


function makeCoordsQuery(location) {
    var query = `
        {
            stops(name: "`+ location + `"){
                lat
                lon
            }
        }
    `
    return query;
}

var address = 'http://api.digitransit.fi/routing/v1/routers/hsl/index/graphql'

module.exports = {
    makeQuery,
    address,
    makeCoordsQuery
}