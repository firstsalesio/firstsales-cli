#!/usr/bin/env node
import { main } from '../src/cli.js';

main(process.argv.slice(2), process.env).then((code) => {
  process.exitCode = code;
});
