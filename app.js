const express = require('express')
const app = express()
const request = require('request')
const port = 3000

let options = {
    url: 'https://app1pub.smappee.net/dev/v1/oauth2/token',
    form: {
        grant_type: 'password',
        client_id: 'allennikka',
        client_secret: 'N3KEMfA0BJ',
        username: 'allennikka',
        password: 'Smap2Energy'
    }
};

app.get('/', (req, res) => {
    request.post(options, function optionalCallback(err, httpResponse, body) {
        if (err) {
            return console.error('upload failed:', err);
        }
        console.log('Upload successful!  Server responded with:', body);
        res.send(body)
    });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`))

