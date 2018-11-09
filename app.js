const express = require('express')
const app = express()
const request = require('request')
var MongoClient = require('mongodb').MongoClient //to go to csv: https://www.npmjs.com/package/json2csv
const port = 3000
const Json2csvParser = require('json2csv').Parser;


const mongo_url = "mongodb://localhost:27017/cphdb";

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

// // Code to set up mongoDb database initially
// MongoClient.connect(mongo_url, { useNewUrlParser: true }, (err, db) => {
//     if (err) throw err;
//     var dbo = db.db("cphdb");
//     dbo.createCollection("sp_data", (err, res) => {
//         if (err) throw err;
//         console.log("Collection created!");
//         db.close();
//     });
// });

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
    first_row: true
}

app.get('/', (req, res) => {
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

function parse_locations(body, err) {

}

app.get('/energy_scrape', (req, res) => {
    res.send('Done getting appliances. Check terminal window for more data.');
    re_appliance_scrape();
});

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
    let mongo_row = {};
    request.get(options_get_appliance_events, (err, httpResponse, body) => {
        mongo_row.appliance = appliance_events_req(body, err);
        request.get(options_get_energy_data, (err, httpResponse, body) => {
            mongo_row.energy = energy_data_req(body, err);
            insert_to_mongodb(mongo_row);
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
        from = Date.now() - 12000000; //for first read, look back 20 minutes to make sure we get the 
        globals.first_row = false;
    } else {
        from = Date.now() - globals.scrape_interval_energy;
    }
    let to = Date.now();
    options_get_energy_data.url += '?aggregation=1&from=' + from + '&to=' + to;
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
    // appliance_events_to_csv(recent_events);    
    console.log('Appliance Event Fetch Successful:', data);
    console.log('Most Recent Event per Appliance csv:', csv);
    delete id_set;
    delete parser;
    return recent_events
}

function energy_data_req(body, err) {
    /*
    Handle body and error returns from anonymous callback on
    request.get() to recieve energy events, return most recent 
    JSON object with previous energy data from smappee
    */
    if (err) {
        return console.error('upload failed:', err);
    }
    var data = JSON.parse(body);
    let last_data = null;
    if (data.consumptions.length > 0) {
        last_data = data.consumptions[0]
    } else {
        //pull in the previous data from mongo
    }
    console.log('Energy Use Event Fetch Successful::', data);
    if (last_data != null) { //FIXME, for testing before we have mongo integration
        energy_data_to_csv(last_data)
        return last_data
        // insert_to_mongodb(last_data)
    } else {
        return 'FIXME: old energy data here!!'
    }
}

function appliance_events_to_csv(recent_events, opts = { fields: ['totalPower', 'activePower'], header: false }) {
    let csv = '';
    const parser = new Json2csvParser(opts);
    for (let i = 0; i < recent_events.length; i++) {
        if (recent_events[i] == null) {
            csv += ',,';
        } else {
            try {
                csv += parser.parse(recent_events[i]);
                csv += ',';
            } catch (err) {
                console.error(err);
            }
        }
    }
    return csv;
}

function energy_data_to_csv(last_data, opts = { fields: ['timestamp', 'consumption'], header: false }) {
    let csv = '';
    try {
        const parser = new Json2csvParser(opts);
        csv = parser.parse(last_data);
        csv = csv.concat(last_data.active.join(), last_data.reactive.join());
        console.log(csv);
        delete parser;
    } catch (err) {
        console.error(err);
    }
    return csv
}

app.listen(port, () => console.log(`Example app listening on port ${port}!`))




let options_init_auth_honeywell = {
    url: 'https://api.honeywell.com/oauth2/authorize',
    form: {
        grant_type: 'code',
        client_id: 'OOak9Q3F3CWOYRxzlnhmt9GBMXdAtUwv',
        redirect_uri: 'http://cyberpoweredhome.com',
    }
}
/**
*
NEST:
https://console.developers.nest.com/products/7ce5f2f9-1971-4933-b340-c7cba51bb7e5


Request from API login page:
Request URL: https://api.honeywell.com/oauth2/app/login?apikey=OOak9Q3F3CWOYRxzlnhmt9GBMXdAtUwv&redirect_uri=http://cyberpoweredhome.com&app=cph-integration
Request Method: POST

requests after successful login, all made sequentially:
Request URL: https://api.honeywell.com/oauth2/app/consent?apikey=OOak9Q3F3CWOYRxzlnhmt9GBMXdAtUwv&app=cph-integration&redirect_uri=http%3A%2F%2Fcyberpoweredhome.com
Request Method: POST

Request URL: https://api.honeywell.com/oauth2/app/acl?apikey=OOak9Q3F3CWOYRxzlnhmt9GBMXdAtUwv&app=cph-integration&redirect_uri=http%3A%2F%2Fcyberpoweredhome.com
Request Method: GET

Request URL: http://cyberpoweredhome.com/?code=Ly0RxRYb&scope=
Request Method: GET
 * 
 */



app.get('/honeywell', (req, res) => {
    let honeywell_url = 'https://api.honeywell.com/oauth2/authorize?response_type=code&client_id=OOak9Q3F3CWOYRxzlnhmt9GBMXdAtUwv&redirect_uri=http://cyberpoweredhome.com';
    res.redirect(honeywell_url);
    // request.post(honeywell_url, function optionalCallback(err, httpResponse, body) {
    //     if (err) {
    //         return console.error('upload failed:', err);
    //     }        
    //     // let data = JSON.parse(body);
    //     console.log('Upload successful!  Server responded with:', body);
    //     res.send('data')
    // });
});
