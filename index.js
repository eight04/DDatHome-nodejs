const { version: VERSION } = require('./package.json')
const { URL } = require('url') // Compatibility
const WebSocket = require('ws')
const PWS = require('pws')
const got = require('got')

function limitCall(fn, maxCall = 120, perMs = 60 * 1000) {
  const callHistory = []
  return (...args) => {
    const now = Date.now()
    while (callHistory.length && callHistory[0] <= now) {
      callHistory.shift()
    }
    if (callHistory.length >= maxCall) {
      throw new Error(`Rate limit exceeded. Please retry after ${callHistory[0] - now}ms`)
    }
    callHistory.push(now + perMs)
    return fn(...args)
  }
}

function startDD({
  verbose = false,
  stdoutColumns = 80,
  url,
  analytics = false,
  nickname,
  parallel = 120,
  interval = 60,
  _log = console.log,
  _info = verbose ? _log : () => {}
}) {
  url = new URL(url);
  if (analytics) {
    url.searchParams.set('runtime', `node${process.version}`)
    url.searchParams.set('version', VERSION)
    url.searchParams.set('platform', process.platform)
    if (process.env.docker) {
      url.searchParams.set('docker', 'docker')
    }
  }
  if (nickname) {
    url.searchParams.set('name', nickname)
  }
  
  _log(`${'D'.repeat(stdoutColumns)}
Thank you for participating DD@Home,
Please read README.md for more information.
${'D'.repeat(stdoutColumns)}`);
  _log(`verbose: ${verbose}`);
  _log(`url: ${url}`);
  _log(`rate: ${parallel} tasks every ${interval}ms`);
  
  const limitedGot = limitCall(
    got,
    parallel * 2,
    interval
  );
  const ws = new PWS(url, undefined, WebSocket, {
    pingTimeout: interval * 2 * 1000
  });
  const processor = createJobProcessor({
    got: limitedGot,
    _info
  });
  
  ws.on('open', () => {
    _info('Connected');
  });
  
  ws.on('close', () => {
    _info('Disconnected');
  });
  
  ws.on('message', async message => {
    let key, data;
    try {
      ({key, data} = JSON.parse(message));
    } catch (err) {
      _log(`Invalid message: ${message}`);
      return;
    }
    
    let response;
    try {
      response = await processor(data);
    } catch (err) {
      // FIXME: what is the correct way to reject a job?
      response = err.message;
    }
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({key, data: response}));
    } else {
      _info('Offline, a job is discarded');
    }
  });
  
  setInterval(pullTasks, interval);
  
  function pullTasks() {
    // add random delay to each task
    // FIXME: why do we need this?
    for (let i = 0; i < parallel; i++) {
      setTimeout(doPull, Math.random() * interval);
    }
  }
  
  function doPull() {
    if (ws.readyState === 1) {
      ws.send('DDhttp');
    } else {
      _info('Offline, cannot pull a job');
    }
  }
}

function createJobProcessor({got, _info}) {
  return async ({type, url}) => {
    if (type !== 'http') {
      throw new Error(`Unknown job type: ${type}`);
    }
    url = new URL(url);
    if (!url.hostname.endsWith('.bilibili.com')) {
      throw new Error(`Illegal URL: ${url}`);
    }
    let result;
    try {
      _info(`gotting ${url}`);
      result = await got(url);
    } catch (err) {
      if (err.statusCode != null) {
        err.message = JSON.stringify({code: err.statusCode});
      }
      throw err;
    }
    return result.body;
  }
}

module.exports = {startDD};
