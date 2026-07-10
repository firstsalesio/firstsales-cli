#!/usr/bin/env node
import { main } from '../src/cli.js';
import { EXIT } from '../src/exit-codes.js';

const argv = process.argv.slice(2);
const debug = argv.includes('--debug');

main(argv, process.env)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    if (debug) {
      console.error(err);
    } else {
      console.error(`firstsales: ${err instanceof Error ? err.message : 'Unexpected error.'}`);
    }
    process.exitCode = EXIT.runtime;
  });
