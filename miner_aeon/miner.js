/* Very simple monero miner which connects to
 * webminerpool.com. */

var server = "wss://webminerpool.com:8282/"  // the webminerpool server

var job = null;		// remember last job we got from the server
var workers = [];	// keep track of our workers
var ws;			// the websocket we use 

/* state variables */

var receiveStack = [];	// everything we get from the server
var sendStack = [];  	// everything we send to the server
var totalhashes = 0; 	// number of hashes created
var connected = 0;   	// 0->disconnected,1->connected,2->disconnected (error)

// starts mining with two threads 
function startMining(pool, login, password) {

  connected = 0;

  setTimeout(function () {

    ws = new WebSocket(server);

    ws.onmessage = on_servermsg;
    ws.onerror = function (event) { connected = 2; job = null; }
    ws.onclose = function () { connected = 2;  job = null; }

    ws.onopen = function () {
      var msg = {
        identifier: "handshake", pool: pool,
        login: login, password: password
      };
      ws.send((JSON.stringify(msg)));
      connected = 1;
    }
  }, 3000);

}


// stop mining  
function stopMining() {
  if (ws != null) ws.close();
  deleteAllWorkers();
  job = null;
  connected = 0;
}

// add one worker 
function addWorker() {
  var newWorker = new Worker("miner/worker.js");
  workers.push(newWorker);

  newWorker.onmessage = on_workermsg;

  setTimeout(function () { informWorker(newWorker); }, 2000);
}

// remove one worker, keep at least one 
function removeWorker() {
  if (workers.length < 2) return;
  var wrk = workers.shift();
  wrk.terminate();
}

/* "internal" functions */

function deleteAllWorkers() {
  for (i = 0; i < workers.length; i++) { workers[i].terminate(); }
  workers = [];
}

function informWorker(wrk) {
    var evt = { data: "wakeup", target: wrk };
    on_workermsg(evt);
}

function on_servermsg(e) {
  var obj = JSON.parse(e.data);

  receiveStack.push(obj);
  
  if (obj.identifier == "job") job = obj;
}

function on_workermsg(e) {
  var wrk = e.target;

  if (connected != 1) {setTimeout(function () { informWorker(wrk); }, 2000); return;}
  
  if ((e.data) != "nothing" && (e.data) != "wakeup") {
    // we solved a hash. forward it to the server.
    var obj = JSON.parse(e.data);
    ws.send(e.data); sendStack.push(obj);
  }

  if (job === null)  {setTimeout(function () { informWorker(wrk); }, 2000); return; }

  wrk.postMessage(JSON.stringify(job));
  
  if ((e.data) != "wakeup") totalhashes += 4;
} 
