#!/usr/bin/env node
'use strict';


//Calling the project harry_plotter as an internal name, change it to whatever you might want to call your project

var express = require('express');
var app = express();
var path = require('path');
var bodyParser = require('body-parser');
var db;
var session_identifier;
// load the Node.js TCP library
const net = require('net');
const PORT = 4040;
const ADDRESS = getLocalIp(); //This will get the ip address of the interface connected to the device, starting with 192.169.
//Change the ADDRESS field if the ip range is different
let server = net.createServer(onClientConnected);
server.listen(PORT, ADDRESS);

function onClientConnected(socket) {
          console.log(`New client: ${socket.remoteAddress}:${socket.remotePort}`);
          socket.destroy();
        }
console.log(`Server started at: ${ADDRESS}:${PORT}`);

function onClientConnected(socket) {
            // Giving a name to this client
            let clientName = `${socket.remoteAddress}:${socket.remotePort}`;
            //Using the UTC time as a unique session identifier,
            //this makes each connection a unique session, and can be saved in a unique database
            session_identifier = Math.floor(new Date() / 1000)

            //Logging into meta_database with the function, and logging the session there
            meta_db_handler();

            //Check if the exact db exists, and if so, drop it to prevent issues. 
            db_check(); 

            // Logging the message on the server
            console.log(`${clientName} connected.`);

            // Triggered on data received by this client
            socket.on('data', (data) => {
                          //Parse the data received, and log it in the console
                          var json = JSON.parse(data);
                          console.log(JSON.stringify(json, null, 4)); //Just comment or remove this line if unwanted or data coming too frequently
                          
                          //prepare the data for furthur stages
                          preparations(json);
                          // acknowledging the data
                          socket.write(`We got your message. Thanks!\n`);
                      //Now we try to input the values into a sqlite db, done via the function create_function
                    });
  // Triggered when this client disconnects
            socket.on('end', () => {
                          // Logging this message on the server
                        console.log(`${clientName} disconnected.`);
                      });
}

/* We are using a meta database to store all the various sessions, this is done with the use of
a session handler identifier. So each session will be referenced with this handler.
The meta_database will be used to tell the plotter and http_connector which sessions needs to be displayed.
Latest entry represents the last session. Later we can add functionality to choose which session to plot.*/
function meta_db_handler () {
            var tmp = 'harry_plotter_'+session_identifier;
            /* We need to open the meta_database then add an entry of the session id and close the database */
            const sqlite3 = require('sqlite3').verbose();
            let db = new sqlite3.Database('meta_database_harry_plotter.db', (err) => {
            if (err) {
                    return console.error(err.message);
                }
            console.log('Connected to the meta_database');
            });
            var create_prepare="CREATE TABLE IF NOT EXISTS meta_database_harry_plotter (session_id TEXT);";
            db.serialize(() => {
                        db.run(create_prepare);
                        db.run('INSERT INTO meta_database_harry_plotter(session_id) VALUES ( ? )' , (tmp));
                        db.close((err) => {
                          if (err) {
                            return console.error(err.message);
                          }
                          console.log('Close the meta_database connection.');
                        });
            });
}

function db_check() {
            const sqlite3 = require('sqlite3').verbose();
            let db = new sqlite3.Database('harry_plotter_'+session_identifier + '.db', (err) => {
            if (err) {
                    return console.error(err.message);
                }
            console.log('Connected to the db_check session database.');
            });
            db.serialize(() => {
                          var drop_prepare="DROP TABLE IF EXISTS harry_plotter_" + session_identifier + "";
                          console.log(drop_prepare)
                          //Delete the table in case it exists
                          db.run(drop_prepare);
                          db.close((err) => {
                            if (err) {
                              return console.error(err.message);
                            }
                            console.log('Close the database connection.');
                          });
            });
}

function table_manipulation(json,db_prepare,insert_prepare,stmt_prepare) {

            //Use below 2 vars if you want to implement UTC to Local time conversion
            var d = new Date();
            var n = d.getTimezoneOffset();
            const sqlite3 = require('sqlite3').verbose();
          // open database in memory
            let db = new sqlite3.Database('harry_plotter_'+session_identifier + '.db', (err) => {
              if (err) {
                return console.error(err.message);
              }
              console.log('Connected to the table manipulation in the session database.');
            });
          //We will know the number of processes being sent to us
          //REDUNDANT; REMOVE LATER
          var i = json.length;
          //Creating command to send create table later
           //AUTOINCREMENT has been removed from DATETIME PRIMARY KEY INCREMENT
          db.serialize(() => {
                    // Queries scheduled here will be serialized.
                    db.run(db_prepare);
                    //Now we need to add data into the columns, because the table exists at this point.
                    //var stmt = db.prepare('INSERT INTO harry_plotter(local_time,cpu_usage) VALUES (?,?)');
                    var stmt = db.prepare(insert_prepare);
                    stmt.run(stmt_prepare);
                    stmt.finalize();
          });

          // close the database connection
          db.close((err) => {
            if (err) {
              return console.error(err.message);
            }
            console.log('Close the database connection.');
          });

}

function preparations(json)
{
          var i = json.length;

          var db_prepare="CREATE TABLE IF NOT EXISTS harry_plotter_" + session_identifier + "(" +
                      "local_time" + " DATETIME PRIMARY KEY , " +
                      "cpu_usage" + " DECIMAL " ;
          var insert_prepare = 'INSERT INTO harry_plotter_' + session_identifier + '(local_time,cpu_usage';

          for(i = 0; i < json.procs.length; i++) {
            var tmp  = (json.procs[i].name+"_name") + " TEXT, " +
                      (json.procs[i].name+"_pid") + " NUMERIC, " +
                      (json.procs[i].name+"_stack") + " NUMERIC, " +
                      (json.procs[i].name+"_heap") + " NUMERIC, " +
                      (json.procs[i].name+"_total") + " NUMERIC";

            var insert_tmp = (json.procs[i].name+"_name ,")  +
                      (json.procs[i].name+"_pid ,")  +
                      (json.procs[i].name+"_stack ,")  +
                      (json.procs[i].name+"_heap ,") +
                      (json.procs[i].name+"_total");

            db_prepare =db_prepare+" , "+tmp;
            insert_prepare = insert_prepare + " , " + insert_tmp;
          }
          db_prepare = db_prepare + ");";
          insert_prepare = insert_prepare + ") VALUES (?,?";

          for(i = 0; i < json.procs.length; i++) {
                      insert_prepare = insert_prepare + ',?,?,?,?,?';
          }
          insert_prepare = insert_prepare + ')';
          var stmt_prepare = [json.utc_time,json.cpu_usage];
              for(i = 0; i < json.procs.length; i++) {
                      stmt_prepare.push(json.procs[i].name,json.procs[i].pid,json.procs[i].stack,json.procs[i].heap,json.procs[i].total)
              }

        table_manipulation(json,db_prepare,insert_prepare,stmt_prepare);
}

//Below function gets local ip and tries to get it of the adapter connected to the device, this is done
//by the use of starts with, change this if the subnet is different. Omit this function if too many errors come up.

function getLocalIp() {
        const os = require('os');

        for(let addresses of Object.values(os.networkInterfaces())) {
            for(let add of addresses) {
                      if(add.address.startsWith('192.168.')) {
        // If error related to IP is shown, uncomment the below line and set the IP manually.
        //const add.address = xxx.xxx.xxx.xxx
                          return add.address;
                      }
            }
        }
}
