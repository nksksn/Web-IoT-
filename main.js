import {requestGPIOAccess} from "./node_modules/node-web-gpio/dist/index.js"; // WebGPIO を使えるようにするためのライブラリをインポート
import {requestI2CAccess} from "./node_modules/node-web-i2c/index.js";

import MPU6050 from "@chirimen/mpu6050";

import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import GPSpackage from 'gps';
const GPS = GPSpackage.GPS;

import nodeWebSocketLib from "websocket"; // https://www.npmjs.com/package/websocket
import {RelayServer} from "./RelayServer.js";

var channel;
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec)); // sleep 関数を定義

async function main() {
  //ブザーの設定
  const gpioAccess = await requestGPIOAccess(); 
  const port1 = gpioAccess.ports.get(26);  
  await port1.export("out"); 

  //加速度センサの初期設定
  var i2CAccess = await requestI2CAccess(); 
  var port2 = i2CAccess.ports.get(5);
  var mpu6050 = new MPU6050(port2, 0x68);
  await mpu6050.init();
  
  //GPSの初期設定
  const port = new SerialPort({ path: '/dev/ttyS0', baudRate: 9600 })
  const parser = port.pipe(new ReadlineParser())
  const gps = new GPS();
  parser.on('data', function (txtData) {
    gps.update(txtData);
  });

  var relay = RelayServer("achex", "chirimenSocket",nodeWebSocketLib,"https://chirimen.org");
  channel = await relay.subscribe("chirimenMbitSensors");

  gps.on('data', function (data) {
    if (data.type == "GGA") { // "RMC"タイプデータを読むと速度(ノット)が得られる
      const gpsData = {
        latitude: gps.state.lat,
        longitude: gps.state.lon
      };
      channel.send(JSON.stringify(gpsData)); // Send
    }
  });

  const data = await mpu6050.readAll();
  const temperature = data.temperature.toFixed(2);
    const g = [data.gx, data.gy, data.gz];
    console.log(
      [
        `Temperature: ${temperature} degree`,
        `Gx: ${g[0]}, Gy: ${g[1]}, Gz: ${g[2]}`,
      ].join("\n")

    );
    
    const acc = Math.sqrt(g[0]**2+g[1]**2+g[2]**2).toFixed(1);
    console.log(acc)
    if(acc > 40){
      port1.write(1)//ブザーが鳴る
    }

}
  
main();