const express = require('express')
const app = express()
const request = require('request')
var MongoClient = require('mongodb').MongoClient
const port = 3000

// var mongo_url = "mongodb://localhost:27017/mydb";

// MongoClient.connect(mongo_url, (err, db) => {
//     if (err) throw err;
//     var dbo = db.db("mydb");
//     dbo.createCollection("sp_adata", (err, res) => {
//         if (err) throw err;
//         console.log("Collection created!");
//         db.close();
//     });
// });

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


const honeywell_url = 'https://api.honeywell.com/oauth2/authorize?response_type=code&client_id=OOak9Q3F3CWOYRxzlnhmt9GBMXdAtUwv&redirect_uri=http://cyberpoweredhome.com';
app.get('/honeywell', (req, res) => {
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

var session = {};
var service_locations = {};

app.get('/', (req, res) => {
    request.post(options_init_auth, function optionalCallback(err, httpResponse, body) {
        if (err) {
            return console.error('upload failed:', err);
        }
        console.log('Upload successful!  Server responded with:', body);
        session = JSON.parse(body);
        options_get_servicelocation.auth.bearer = session.access_token;
        setTimeout(refresh_my_token, session.expires_in + 10)
        res.redirect('/auth_success')
    });
});

function refresh_my_token(){
    let options = {
        url: 'https://app1pub.smappee.net/dev/v1/oauth2/token',
        form: {
            grant_type: 'refresh_token',
            refresh_token: session.refresh_token,
            client_id: 'allennikka',
            client_secret: 'N3KEMfA0BJ'
        }
    };
    request.post(options, (err, httpResponse, body) => {
        if (err) {
            return console.error('upload failed:', err);
        }
        // console.log('Upload successful!  Server responded with:', body);
        session = JSON.parse(body);
        options_get_servicelocation.auth.bearer = session.access_token;
        setTimeout(refresh_my_token, session.expires_in + 10)
    });
}

var options_get_servicelocation = {
    url: 'https://app1pub.smappee.net/dev/v1/servicelocation',
    auth: {
        bearer: null
    }
}

app.get('/auth_success', (req, res) => {
    request.get(options_get_servicelocation, (err, httpResponse, body) => {
        if (err) {
            return console.error('upload failed:', err);
        }
        console.log('Loc Request Successful!  Server responded with:', body);
        service_locations = JSON.parse(body).serviceLocations;
        // res.send(service_locations)
        res.redirect('/energy_scrape')
    });
});

var get_energy_data_interval = 60 * 10 * 1000; //in mseconds (10 mins)

var options_get_energy_data = {
    url: null, //[SERVICELOCATIONID]/events
    auth: {
        bearer: null
    },
};

function re_energy_scrape() {
    //configured to get last location, in this case the Smappee pro unit, update query
    options_get_energy_data.url = 'https://app1pub.smappee.net/dev/v1/servicelocation/' +
        service_locations[service_locations.length - 1].serviceLocationId + '/consumption'
    options_get_energy_data.auth.bearer = session.access_token;
    let from = Date.now() - get_energy_data_interval;
    let to = Date.now();
    options_get_energy_data.url += '?aggregation=1&from=' + from + '&to=' + to;

    request.get(options_get_energy_data, (err, httpResponse, body) => {
        if (err) {
            return console.error('upload failed:', err);
        }
        var data = JSON.parse(body);
        console.log('Loc Request Successful!  Server responded with:', data);
        // res.send(options_get_energy_data.url + ' : ' + data )        
        // res.redirect('/energy_scrape')
    });
    setTimeout(re_energy_scrape, 10000);
}

app.get('/energy_scrape', (req, res) => {
    res.send('done')
    re_energy_scrape();
});





app.listen(port, () => console.log(`Example app listening on port ${port}!`))



