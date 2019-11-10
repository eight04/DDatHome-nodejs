const neodoc = require("neodoc")

const args = neodoc.run(`
Start DD@Home client

usage: ddathome [options]

options:
  -v, --verbose       Be more verbose. [env: VERBOSE]
  --url <url>         The URL of the server. [default: wss://cluster.vtbs.moe]
  --no-analytics      Disable analytics. [env: HIDE]
  --nickname <name>   A optional nickname to display on statistics board (in
                      progress). [env: NICKNAME]
  --interval <time>   Pull task interval in ms. [default: 23040]
  --parallel <number> Pull <number> tasks each time. [default: 48]
`.trim());

require(".").startDD({
  verbose: args['--verbose'],
  url: args['--url'],
  stdoutColumns: process.stdout.columns,
  analytics: !args['--no-analytics'],
  nickname: args['--nickname'],
  parallel: args['--parallel']
});
