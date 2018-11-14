const express = require('express')
const app = express()
const port = 3000

app.get('/', (req, res) => res.send('Hello World!'))

app.listen(port, () => console.log(`Example app listening on port ${port}!`))

function create_recent_test() {
    var recent_events = [];
    let null_event = { totalPower: null, activePower: null };
    let prev_events = [];
    for (let i = 0; i < 10; i++) {
        let event = { totalPower: null, activePower: null }
        event.activePower = Math.random() * 10 - 5;
        if (Math.random() * 10 > 5) {
            recent_events.push(event);
            prev_events.push(-1);
        } else {
            recent_events.push(null_event);
            prev_events.push(1);
        }
    }
    console.log(recent_events);
    appliance_events_to_csv(recent_events, prev_events);
}


function appliance_events_to_csv(recent_events, prev_events) {
    let csv = '';
    var sign;
    var out = [];
    for (let i = 0; i < recent_events.length; i++) {
        try {
            sign = recent_events[i].activePower;
            if (sign != null) {
                if (sign > 0) {
                    out[i] = 1;
                } else {
                    out[i] = -1;
                }
            } else {
                out[i] = prev_events[i];
            }
        } catch (err) {
            console.error(err);
        }
    }
    // return out;
    console.log(prev_events);
    console.log(out);
    console.log(out.toString())
    // return csv;
}

create_recent_test();