#!/usr/bin/env node
const { spawnSync } = require('child_process')
require('dotenv').config({ path: '.env.test' })

const args = ['node_modules/vitest/dist/cli.js', 'run']
const res = spawnSync('node', args, { stdio: 'inherit' })
process.exit(res.status)
