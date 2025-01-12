import {requestGPIOAccess} from "./node_modules/node-web-gpio/dist/index.js";
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
import nodeWebSocketLib from "websocket"; // https://www.npmjs.com/package/websocket
import {RelayServer} from "./RelayServer.js";

import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import GPSpackage from 'gps';
const GPS = GPSpackage.GPS;

var channel;
var gpsData;

async function connect(){
    var relay = RelayServer("chirimentest", "chirimenSocket", nodeWebSocketLib, "https://chirimen.org");
    channel = await relay.subscribe("ninja-iot");
//    channel.onmessage = transmit;
    while(true){
        transmit({data:"GET GPS"});
        await sleep(1000);
    }
}

async function transmit(message){
    console.log(message.data);
    if(message.data == "GET GPS"){
        channel.send(gpsData);
        console.log(JSON.stringify(gpsData));
    }
}

const port = new SerialPort({ path: '/dev/ttyS0', baudRate: 9600 })
const parser = port.pipe(new ReadlineParser())
const gps = new GPS();

parser.on('data', function (txtData) {
    gps.update(txtData);
});

gps.on('data', function (data) {
    if (data.type == "RMC"){
        //console.log(data);
        //console.log(data.lat);
        //console.log(data.lon);
        //console.log(data.course);
        data.role="oni";
        gpsData = data;
        //console.log("==============================================================");
    }

    });

connect();

