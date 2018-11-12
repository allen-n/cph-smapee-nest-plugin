const express = require('express')
const app = express()
const request = require('request')
var MongoClient = require('mongodb').MongoClient //to go to csv: https://www.npmjs.com/package/json2csv
const port = 3000
const Json2csvParser = require('json2csv').Parser;
const fs = require('fs');
const https = require('https');

var globals = {
    session: {},
    service_locations: {},
    active_location_id: null,
    options_get_servicelocation: {
        url: 'https://app1pub.smappee.net/dev/v1/servicelocation',
        auth: {
            bearer: null
        }
    },
    scrape_interval_energy: 30000, // scrape for consumption data every 30 seconds
    appliances: {},
    scrape_interval_appliance: 86400000, //scrape for new appliances once a day
    first_row: true,
    num_appliances: -1,
    nest: {}
}

app.get('/printdb', (req, res) => {
    get_all_mongodb((response) => {
        let str = '';
        let csv = '';
        let download_csv = '';
        for (let i = 0; i < response.length; i++) {
            csv = i + ',';
            csv += response[i].srv_time + ',';
            csv += energy_data_to_csv(response[i].energy);
            csv += appliance_events_to_csv(response[i].appliance);
            csv += thermostat_to_csv(response[i].thermostat)
            download_csv += csv + '\r\n';
            str += csv + '<br>'
        }
        var my_html = '<button onclick="location.href = \'https://cyberpoweredhome.com:3000/printdb\';">Refresh List</button> \
        <button onclick="location.href = \'https://cyberpoweredhome.com:3000/download_data\';">Download CSV</button><br> \
        Index, Srv_Time, Timestamp, Total_Consumption, Active[main1, main2, main3, c1,c2,c3,c4,c5,c6], \
        Reactive[main1, main2, main3, c1,c2,c3,c4,c5,c6], Appliance[id_0...id_n],humidity(%),ambient_temp(F), \
        fan(1/0), fan_timer_duration(min), target_temp(F) <br>';
        res.send(my_html + str);
        fs.writeFile(__dirname + '/data/cph_data.csv', download_csv, function (err) {
            if (err) throw err;
            console.log('Saved!');
        });
    });
});

app.get('/download_data', (req, res) => {
    var file = __dirname + '/data/cph_data.csv';
    res.download(file); // Set disposition and send it.
    // res.redirect('/printdb')
});

app.get('/start', (req, res) => {
    let options_init_auth = {
        url: 'https://app1pub.smappee.net/dev/v1/oauth2/token',
        form: {
            grant_type: 'password',
            client_id: 'allennikka',
            client_secret: 'N3KEMfA0BJ',
            username: 'allennikka',
            password: 'Smap2Energy'
        }
    };

    request.post(options_init_auth, (err, httpResponse, body) => {
        if (err) {
            return console.error('upload failed:', err);
        }
        // console.log('Upload successful!  Server responded with:', body);
        globals.session = JSON.parse(body);
        globals.options_get_servicelocation.auth.bearer = globals.session.access_token;
        setTimeout(refresh_my_token, globals.session.expires_in + 10)
        res.redirect('/auth_success')
    });
});

app.get('/auth_success', (req, res) => {
    request.get(globals.options_get_servicelocation, (err, httpResponse, body) => {
        if (err) {
            return console.error('upload failed:', err);
        }
        // console.log('Loc Request Successful!  Server responded with:', body);
        globals.service_locations = JSON.parse(body).serviceLocations;
        globals.active_location_id = globals.service_locations[globals.service_locations.length - 1].serviceLocationId;

        res.redirect('/energy_scrape')
    });
});

app.get('/energy_scrape', (req, res) => {
    res.send('Done getting appliances. Check terminal window for more data.<br> <button onclick="location.href = \'https://cyberpoweredhome.com:3000/printdb\';">Click for DB</button>');
    re_appliance_scrape();
});

// app.listen(port, () => console.log(`Example app listening on port ${port}!`))
https.createServer({
    key: fs.readFileSync(__dirname + '/certs/server.key'),
    cert: fs.readFileSync(__dirname + '/certs/server.cert')
}, app)
    .listen(port, function () {
        console.log(`Example app listening on port ${port}!`)
    })

function refresh_my_token() {
    let options = {
        url: 'https://app1pub.smappee.net/dev/v1/oauth2/token',
        form: {
            grant_type: 'refresh_token',
            refresh_token: globals.session.refresh_token,
            client_id: 'allennikka',
            client_secret: 'N3KEMfA0BJ'
        }
    };
    request.post(options, (err, httpResponse, body) => {
        if (err) {
            return console.error('upload failed:', err);
        }
        // console.log('Upload successful!  Server responded with:', body);
        globals.session = JSON.parse(body);
        globals.options_get_servicelocation.auth.bearer = globals.session.access_token;
        setTimeout(refresh_my_token, globals.session.expires_in + 10)
    });
}

function gen_get_appliances() {
    let options = {
        url: null, //[SERVICELOCATIONID]/events
        auth: {
            bearer: null
        },
    };
    //configured to get last location, in this case the Smappee pro unit, update query
    options.url = 'https://app1pub.smappee.net/dev/v1/servicelocation/' +
        globals.active_location_id + '/info'
    options.auth.bearer = globals.session.access_token;
    return options;
}

function re_appliance_scrape() {
    let options_get_appliances = gen_get_appliances();
    request.get(options_get_appliances, (err, httpResponse, body) => {
        if (err) {
            return console.error('upload failed:', err);
        }
        var data = JSON.parse(body);
        globals.num_appliances = data.appliances.length;
        // console.log(data);
        //only do this on first run, timeouts will continue subsequent re_energy_scrape()
        if (globals.first_row) {
            re_energy_scrape(); //Now that we have the total list of devices, look at device events
        }
    });
    setTimeout(re_appliance_scrape, globals.scrape_interval_appliance);
}

function re_energy_scrape() {
    /*
    Scrape for energy and appliance events in last globals.scrape_interval_energy time period
    */
    let options_get_appliance_events = gen_get_appliance_events();
    let options_get_energy_data = gen_get_energy_data();
    let options_get_thermostat = gen_get_thermostat_data();
    let mongo_row = {};
    request.get(options_get_appliance_events, (err, httpResponse, body) => {
        mongo_row.appliance = appliance_events_req(body, err);
        request.get(options_get_energy_data, (err, httpResponse, body) => {
            energy_data_req(body, err, (energy_resp) => {
                mongo_row.energy = energy_resp;
                request.get(options_get_thermostat, (err, httpResponse, body) => {
                    mongo_row.thermostat = (JSON.parse(body)).devices.thermostats;
                    mongo_row.srv_time = Date.now();
                    insert_to_mongodb(mongo_row);
                });
            });
        });
    });
    setTimeout(re_energy_scrape, globals.scrape_interval_energy);
}

function gen_get_appliance_events() {
    /*
    Generate options JSON for request.get() call to get 
    appliance events in last globals.scrape_interval_energy time period
     */
    let options = {
        url: null, //[SERVICELOCATIONID]/events
        auth: {
            bearer: null
        },
    };
    //configured to get last location, in this case the Smappee pro unit, update query
    options.url = 'https://app1pub.smappee.net/dev/v1/servicelocation/' +
        globals.active_location_id + '/events?'
    options.auth.bearer = globals.session.access_token;
    for (p in globals.appliances) {
        let id = p.id;
        options.url += 'applianceId=' + id + '&';
    }
    let from = Date.now() - globals.scrape_interval_energy;
    let to = Date.now();
    options.url += 'maxNumber=100&';
    options.url += 'from=' + from + '&to=' + to;
    return options;
}

function gen_get_energy_data() {
    /*
    Generate options JSON for request.get() call to get 
    energy events in last globals.scrape_interval_energy time period
    */
    let options_get_energy_data = {
        url: null, //[SERVICELOCATIONID]/events
        auth: {
            bearer: null
        },
    };
    //configured to get last location, in this case the Smappee pro unit, update query
    options_get_energy_data.url = 'https://app1pub.smappee.net/dev/v1/servicelocation/' +
        globals.active_location_id + '/consumption'
    options_get_energy_data.auth.bearer = globals.session.access_token;
    let from = '';
    if (globals.first_row) {
        from = Date.now() - 1200000; //for first read, look back 20 minutes to make sure we get an event 
        globals.first_row = false;
    } else {
        from = Date.now() - globals.scrape_interval_energy;
    }
    let to = Date.now();
    options_get_energy_data.url += '?aggregation=1&from=' + from + '&to=' + to;
    // console.log('the energy data request is:');
    // console.log(options_get_energy_data.url);
    return options_get_energy_data;
}

function appliance_events_req(body, err) {
    /*
    Handle body and error returns from anonymous callback on
    request.get() to recieve appliance events, return
    array of appliance event json in index order
    */
    if (err) {
        return console.error('upload failed:', err);
    }
    var data = JSON.parse(body);

    let id_set = new Set();
    let recent_events = [];
    let csv = '';
    if (data.length > 0) {
        for (i in data) {
            if (!id_set.has(data[i].applianceId)) {
                id_set.add(data[i].applianceId);
                let my_id = data[i].applianceId;
                let my_obj = data[i];
                recent_events[my_id] = my_obj;
            }
        }
    }

    let null_event = { totalPower: null, activePower: null };
    for (let i = 0; i < globals.num_appliances; i++) {
        if (typeof recent_events[i] == 'undefined') {
            recent_events[i] = null_event;
        }
    }
    // appliance_events_to_csv(recent_events);    
    // console.log('Appliance Event Fetch Successful:', data);
    // console.log('Most Recent Event per Appliance csv:', csv);
    delete id_set;
    delete parser;

    return recent_events
}

function energy_data_req(body, err, callback) {
    /*
    Handle body and error returns from anonymous callback on
    request.get() to recieve energy events, return most recent 
    JSON object with previous energy data from smappee
    */
    if (err) {
        return console.error('upload failed:', err);
    }
    var data = JSON.parse(body);
    // console.log('energy data req:');
    // console.log(data);
    let last_data = null;
    if (data.consumptions.length > 0) {
        last_data = data.consumptions[0]
        callback(last_data);
    } else {
        get_latest_mongodb((error, response) => {
            // console.log('old data fetch ' + last_data);
            last_data = response.energy;
            callback(last_data);
        });
    }
    // console.log('Energy Use Event Fetch Successful::', data);
}

function appliance_events_to_csv(recent_events, opts = { fields: ['totalPower', 'activePower'], header: false }) {
    let csv = '';
    const parser = new Json2csvParser(opts);
    for (let i = 0; i < recent_events.length; i++) {
        // if (recent_events[i] == null) {
        //     csv += ',x';
        // } else {
        try {
            csv += ',';
            csv += parser.parse(recent_events[i]);
        } catch (err) {
            console.error(err);
        }
    }
    // }
    // if (recent_events.length == 0) {
    //     for (let i = 0; i < globals.num_appliances; i++) {
    //         csv += ',xs';

    //     }
    // }
    return csv;
}

function energy_data_to_csv(last_data, opts = { fields: ['timestamp', 'consumption'], header: false }) {
    let csv = '';
    try {
        const parser = new Json2csvParser(opts);
        csv = parser.parse(last_data);
        csv = csv.concat(',', last_data.active.join(), ',', last_data.reactive.join());
        // console.log(csv);
        delete parser;
    } catch (err) {
        // console.error(err);
    }
    return csv
}

function insert_to_mongodb(json, collection_name = 'sp_data', mongo_url = 'mongodb://localhost:27017/cphdb') {
    MongoClient.connect(mongo_url, { useNewUrlParser: true }, (err, db) => {
        if (err) throw err;
        var dbo = db.db("cphdb");
        dbo.collection(collection_name).insertOne(json, function (err, res) {
            if (err) throw err;
            console.log("1 document inserted");
            db.close();
        });
    });
}

function get_latest_mongodb(callback, collection_name = 'sp_data', mongo_url = 'mongodb://localhost:27017/cphdb') {
    let last_val = null;
    MongoClient.connect(mongo_url, { useNewUrlParser: true }, (err, db) => {
        if (err) throw err;
        var dbo = db.db("cphdb");
        dbo.collection(collection_name).findOne({}, { sort: { $natural: -1 } }, (err, res) => {
            if (err) throw err;
            console.log('Last event fetched from mongodb');
            callback(err, res)
        })
    });
}

function get_all_mongodb(callback, num_records = 100, natural_order = false, collection_name = 'sp_data', mongo_url = 'mongodb://localhost:27017/cphdb') {
    let ord = -1;
    if (natural_order) {
        ord = 1;
    }
    MongoClient.connect(mongo_url, { useNewUrlParser: true }, (err, db) => {
        if (err) throw err;
        var dbo = db.db("cphdb");
        dbo.collection(collection_name).find({}, { sort: { $natural: ord } }).limit(num_records).toArray((err, res) => {
            if (err) throw err;
            // console.log('all events fetched from mongodb');
            // console.log(res);
            callback(res);
        });
    });
}

app.get('/nest', (req, res) => {
    res.redirect('https://home.nest.com/login/oauth2?client_id=7ce5f2f9-1971-4933-b340-c7cba51bb7e5&state=STATE');
});

app.get('/nest_auth_success*', (req, res) => {
    let state = req.query.state;
    let my_code = req.query.code;
    var my_html = '<br><button onclick="location.href = \'https://cyberpoweredhome.com:3000/start\';">Click to Start</button>';
    let options_init_auth = {
        url: 'https://api.home.nest.com/oauth2/access_token',
        form: {
            client_id: '7ce5f2f9-1971-4933-b340-c7cba51bb7e5',
            client_secret: 'GuQLCuwXWkrjZg3CxjLTsT27k',
            grant_type: 'authorization_code',
            code: my_code
        }
    };

    request.post(options_init_auth, (err, httpResponse, body) => {
        if (err) {
            return console.error('upload failed:', err);
        }
        // console.log('Upload successful!  Server responded with:', body);
        globals.nest.session = JSON.parse(body);
        res.send("Code: " + my_code + ", State: " + state + "<br>Nest Auth Complete, start collecting data." + my_html);
        // get_thermostat_data();
        // setTimeout(refresh_my_token_nest, globals.nest.session.expires_in + 10)
        // res.redirect('/auth_success')
    });
});

function gen_get_thermostat_data() {
    let options = {
        url: 'https://developer-api.nest.com', //[SERVICELOCATIONID]/events
        auth: {
            bearer: null
        },
    };
    options.auth.bearer = globals.nest.session.access_token;
    return options;
}

function get_thermostat_data(callback = null) {
    /* Generate options JSON for request.get() call to get 
    energy events from Nest API, takes @callback as a param, 
    callback is an anonymous function that can take @csv as 
    an argument, which is a csv containing (ambient humidity (%), 
    ambient temp (F), fan (0=off, 1=on), fan timer duration,
    (min), target temperature (F)*/
    let options = {
        url: 'https://developer-api.nest.com', //[SERVICELOCATIONID]/events
        auth: {
            bearer: null
        },
    };
    options.auth.bearer = globals.nest.session.access_token;
    request.get(options, (err, httpResponse, body) => {
        // console.log(body)
        let data = JSON.parse(body);
        let csv = thermostat_to_csv(data);
        callback(csv);
        // console.log(csv)
        // console.log(thermostat_to_csv(data))
    });
}

function thermostat_to_csv(data, thermostat = '2qOT3CZVKfGwpIlxd_-B3gA9J-4dxXeB') {
    /* Function to take in the parsed JSON representing a response from
    the Nest API as @data, and taking an optional @thermostat argument 
    to specify which thermostat is being monitored. The output is a csv
    formatted datastring containing:
     (ambient humidity (%), ambient temp (F), fan (0=off, 1=on), fan timer duration,
     (min), target temperature (F) */
    let csv = '';
    let my_tstat = data[thermostat];
    let mode = null;
    let target_temp = null;
    try {
        switch (my_tstat.hvac_mode) {
            case 'heat':
                mode = 1;
                target_temp = my_tstat.target_temperature_f;
                break;
            case 'cool':
                mode = 2;
                target_temp = my_tstat.target_temperature_f;
                break;
            case 'heat-cool':
                mode = 3;

                target_temp = get_target_temp(
                    my_tstat.ambient_temperature_f,
                    my_tstat.target_temperature_high_f,
                    my_tstat.target_temperature_low_f
                );
                break;
            case 'eco':
                mode = 4;
                target_temp = get_target_temp(
                    my_tstat.ambient_temperature_f,
                    my_tstat.eco_temperature_high_f,
                    my_tstat.eco_temperature_low_f
                );
                break;
            default:
                mode = 0;
                target_temp = my_tstat.ambient_temperature_f;
                break;
        }
        csv = my_tstat.humidity + ',' + my_tstat.ambient_temperature_f + ',';
        if (my_tstat.fan_timer_active) {
            csv += '1,' + my_tstat.fan_timer_duration + ',';
        } else {
            csv += '0,' + my_tstat.fan_timer_duration + ',';
        }
        csv += mode + ',' + target_temp;
    } catch (error) {
        throw error;
    }
    return csv;
}

function get_target_temp(ambient_temp, target_high, target_low) {
    /* Helper function for thermostat_to_csv() that takes ambient
    temperature and target high and low temps to return the target 
    temperature */
    if (ambient_temp > target_high) {
        return target_high
    } else if (ambient < target_low) {
        return target_low
    } else {
        return ambient_temp;
    }
}

// function refresh_my_token_nest() {
//     let options = {
//         url: 'https://api.home.nest.com/oauth2/access_token',
//         form: {
//             client_id: '7ce5f2f9-1971-4933-b340-c7cba51bb7e5',
//             client_secret: 'GuQLCuwXWkrjZg3CxjLTsT27k',
//             grant_type: 'authorization_code',
//             code: my_code
//         }
//     };
//     request.post(options, (err, httpResponse, body) => {
//         if (err) {
//             return console.error('upload failed:', err);
//         }
//         // console.log('Upload successful!  Server responded with:', body);
//         globals.nest.session = JSON.parse(body);
//         setTimeout(refresh_my_token_ntest, globals.session.expires_in + 10)
//     });
// }