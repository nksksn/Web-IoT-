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
  const port1 = gpioAccess.ports.get(21);  
  await port1.export("out"); 

  //加速度センサの初期設定
  var i2CAccess = await requestI2CAccess(); 
  var port2 = i2CAccess.ports.get(1);
  var mpu6050 = new MPU6050(port2, 0x68);
  await mpu6050.init();

  var i = 0; 
  var count = 0; // 術発動用の時間カウンター
  var temp_rx = 0;
  var temp_ry = 0;
  var temp_rz = 0;
  
  //GPSの初期設定
  const port = new SerialPort({ path: '/dev/ttyS0', baudRate: 9600 })
  const parser = port.pipe(new ReadlineParser())
  const gps = new GPS();
  parser.on('data', function (txtData) {
    gps.update(txtData);
  });

  // webSocketリレーの初期化
  var relay = RelayServer("chirimentest", "chirimenSocket",nodeWebSocketLib,"https://chirimen.org");
  channel = await relay.subscribe("ninja-iot");
  console.log("web socketリレーサービスに接続しました");

  // センサーの初期化
  while (i < 100){
    const data_mpu = await mpu6050.readAll();
    temp_rx = temp_rx + data_mpu.rx;
    temp_ry = temp_ry + data_mpu.ry;
    temp_rz = temp_rz + data_mpu.rz;
    i = i + 1;
  }
  const err_rx = temp_rx/i; //3.783; // Error Rx
  const err_ry = temp_ry/i; //0.487; // Error Ry
  const err_rz = temp_rz/i; //-0.01; // Error Rz
  
  // ディバッグ用：
  console.log(
  [
  `/////////////////// 初期化TEST //////////////////////`,	
  `temp_rx: ${temp_rx}, temp_ry: ${temp_ry}, temp_rz: ${temp_rz}`,
  `err_rx: ${err_rx}, err_ry: ${err_ry}, err_rz: ${err_rz}`,
  `////////////////////// TEST ////////////////////////`
  ].join("\n")
  );
      
  while (true) {
      const data_mpu = await mpu6050.readAll();
      const temperature = data_mpu.temperature.toFixed(2);
      const g = [data_mpu.gx, data_mpu.gy, data_mpu.gz];
      const r = [data_mpu.rx - err_rx, data_mpu.ry - err_ry, data_mpu.rz - err_rz];
     
     //　加速度を計算
	  const acc = Math.sqrt(r[0]**2+r[1]**2+r[2]**2).toFixed(1);
    //console.log(`Accelation:${acc}`)//コンソール用
    
    // ディバッグ用：
    console.log(
      [
      //`Temperature: ${temperature} degree`,
      //`Gx: ${g[0].toFixed(2)}, Gy: ${g[1].toFixed(2)}, Gz: ${g[2].toFixed(2)}`,
      `Gx: ${g[0].toFixed(2)}`,
      `count: ${count}`,
      //`Rx: ${r[0].toFixed(1)}, Ry: ${r[1].toFixed(1)}, Rz: ${r[2].toFixed(1)}`,
      `Acceleration: ${acc}`
      ].join("\n")
    );

    gps.on('data', function (data) {
      if (data.type == "RMC") { // "RMC"タイプデータを読むと速度(ノット)が得られる
        const gpsData = {
          latitude: gps.state.lat,
          longitude: gps.state.lon,
          Accelation: acc
        };
        data.role = "sinobi";
      channel.send(JSON.stringify(gpsData)); // Send
      console.log(JSON.stringify(gpsData))
      }
    });
  
    // サーバにメッセージを送信する
    if (g[0] > 0.8 && acc < 100) {
      channel.send(`SAFE`);
      console.log(`SAFE`);
    } else if (g[0] > -0.20 && g[0] < 0.20 && acc < 100) {
      count = count + 1;
      
      // 保持時間＝count*loop await sleep 時間
      if (count > 6){
        channel.send(`WAZA`);
        console.log(`WAZA`);
        count = 0;
      }
    } else {
      channel.send(`DANGER`);
      console.log(`DANGER`);
      count = 0;
    } 

    //ブザー
    if(acc > 100){
         port1.write(1)//ブザーが鳴る
    }

    await sleep(500);
  }

}
  
main();