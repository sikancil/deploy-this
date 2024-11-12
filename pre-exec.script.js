#!/usr/bin/env node
console.log("Running PreExecution Script...")

const fs = require("node:fs")
const path = require("node:path")
const child_process = require("node:child_process")

const projectRoot = process.cwd()

// Check if `dist` distribution directory exists
if (!fs.existsSync(path.join(projectRoot, "dist"))) {
  // If not, create it
  const buildResult = child_process.spawn("npm", ["run", "build"])
  buildResult.stdout.on("data", (data) => {
    console.log(data.toString())
  })
  buildResult.stderr.on("data", (data) => {
    console.error(data.toString())
  })
  buildResult.on("close", (code) => {
    console.log(`✅ Build Script executed (${code}).\n\n`)
    process.exit(1)
  })
} else {
  // If it does, check if `dist/index.js` file exists, and `dist/templates` directory exists
  if (!fs.existsSync(path.join(projectRoot, "dist/index.js")) || !fs.existsSync(path.join(projectRoot, "dist/templates"))) {
    // If not, copy the `dist/index.js` file to `dist/templates/terraforms/asg/cloud-init.sh`
    const buildResult = child_process.spawn("npm", ["run", "build"])
    buildResult.stdout.on("data", (data) => {
      console.log(data.toString())
    })
    buildResult.stderr.on("data", (data) => {
      console.error(data.toString())
    })
    buildResult.on("close", (code) => {
      console.log(`✅ Build Variables Script executed (${code}).\n\n`)
      process.exit(0)
    })
  } else {
    const buildTemplatesResult = child_process.spawn("npm", ["run", "build:templates"])
    buildTemplatesResult.stdout.on("data", (data) => {
      console.log(data.toString())
    })
    buildTemplatesResult.stderr.on("data", (data) => {
      console.error(data.toString())
    })
    buildTemplatesResult.on("close", (code) => {
      console.log(`✅ Build Templates Script executed (${code}).\n\n`)
      process.exit(0)
    })
  }
}
