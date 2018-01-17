var express = require('express');
var curl = require('curl');
var app = express();
var bParser = require('body-parser');
var axios = require('axios');

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.use(bParser.json());
app.use(bParser.urlencoded({
    extended: true
}));

app.listen(3001);

var address = 'http://api.digitransit.fi/routing/v1/routers/hsl/index/graphql'
var start = ''
var end = ''

var start_coord = { lat: 0, lon: 0 };
var end_coord = { lat: 0, lon: 0 };


var now = new Date();

function makeQuery() {
    now = new Date();
    var time = now.toString().split(' ')[4];

    var month = (now.getMonth() + 1).toString();
    if (month.length == 1) month = '0' + month;

    var d = now.getDate().toString();
    if (d.length == 1) d = '0' + d;

    var year = now.getFullYear();
    var date = "" + year + "-" + month + "-" + d;

    var from = start_coord;
    var to = end_coord;

    var fromPlace = start;
    var toPlace = end;

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

var walkDistance = 0;
var duration = 0;
var startTime = 0;
var endTime = 0;
var startStop = '';
var endStop = '';
var itinerary = []
var walkDistance = 0;
var wholeTime = 0;
var leaving = 0;
var ss = 0;
var es = 0;
var bus = '';

var items = []

function queryHSL() {
    var query = makeQuery()
    curl.post(address, query, { "Content-Type": "application/graphql" }, function (err, response, body) {
        if (err) {
            console.log('Unhandled error.');
        }
        else {
            console.log("from hsl query: " + response.statusCode);
            if (response.statusCode != 200) console.log('Couldnt get data.');
            else {
                var json = JSON.parse(body).data.plan;
                var itineraries = json.itineraries;

                for (i = 0; i < itineraries.length; i++) {
                    var it = itineraries[i];
                    itinerary.push({ duration: it.duration, walkDistance: it.walkDistance, legs: it.legs });
                }

                for (i = 0; i < itinerary.length; i++) {
                    var it = itinerary[i];
                    walkDistance = Math.ceil(it.walkDistance);
                    for (j = 0; j < it.legs.length; j++) {
                        var leg = it.legs[j];
                        if (leg.mode == 'BUS') {
                            startTime = leg.startTime;
                            endTime = leg.endTime;
                            startStop = leg.from.name
                            endStop = leg.to.name
                            bus = leg.route.shortName
                        }
                    }
                }

                duration = Math.ceil((endTime - startTime) / 1000.0 / 60.0);
                wholeTime = Math.ceil((endTime - now.getTime()) / 1000.0 / 60);
                leaving = (startTime - now.getTime()) / 1000.0 / 60;
                startTime = new Date(startTime);
                endTime = new Date(endTime);

                ss = startTime.toString().split(" ")[4];
                es = endTime.toString().split(" ")[4];
            }
        }
    });
}

function makeCoordsQuery(location) {

    console.log('query from: ' + location);

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

function setCoords(coords, query, callback) {
    axios({
        method: 'post',
        url: address,
        data: query,
        headers: {"Content-Type": "application/graphql"}
    }).then(function (response) {
        var stops = response.data.data.stops
        if (stops.length != 0) {
            var stop = stops[0];
            coords.lat = stop.lat;
            coords.lon = stop.lon;
            callback({lat: stop.lat, lat: stop.lon, status: 200})
        } else {
            callback({message: 'No stops found.', status: 400})
        }
    }).catch(function(error){
        if(error.response.status == 500){
            callback({error: error.response.statusText, status: error.response.status})
        } else {
            callback({error: 'Unhandled error.', status: 450})
        }
    });
}

function printArray(data) {
    for (i = 0; i < data.length; i++) {
        console.log(data[i]);
    }
}

//queryN(1);
function queryN(n) {

    //for (var i = 0; i < n; i++) {
    var query = `
    {
        "query": "{
          stop(id: \"HSL:1040129\") {
            name
            lat
            lon
            wheelchairBoarding
          }
        }"
      }`

    axios.post(address, query, { "Content-Type": "application/graphql" }).then(function (body, b) { console.log('curl then success? ' + JSON.parse(body).data) }).catch(function (error) { console.log(error.response.statusText) });
    //}

}

app.get('/data', function (req, res) {
    res.set('Content-Type', 'application/json')
    res.set('Access-Control-Allow-Origin', '*')
   /* //queryN(1)
    queryHSL();
    res.send({ bus: bus, walkDistance: walkDistance, ss: ss, es: es, duration: duration, startStop: startStop, endStop: endStop, wholeTime: wholeTime, leaving: leaving });*/
    
})

app.post('/set', function (req, res) {
    console.log(req.body);
    var data = req.body;

    start = data.start;
    end = data.end;

    var start_query = makeCoordsQuery(start);
    setCoords(start_coord, start_query);
    var end_query = makeCoordsQuery(end);
    setCoords(end_coord, end_query);

    queryHSL();
    //queryN(1);
    res.send({ bus: bus, walkDistance: walkDistance, ss: ss, es: es, duration: duration, startStop: startStop, endStop: endStop, wholeTime: wholeTime, leaving: leaving });
});