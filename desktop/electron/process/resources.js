import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import which from 'which'

export function extraResolve(filePath) {
  const resolvePath = base => resolve(base, 'extra', filePath)

  if (import.meta.env.MODE !== 'production')
    return resolvePath('electron/resources')

  const prodPath = resolvePath(process.resourcesPath || '')
  if (prodPath && existsSync(prodPath))
    return prodPath

  const fallback = resolvePath('electron/resources')
  if (existsSync(fallback))
    return fallback

  return prodPath
}

export function buildResolve(value) {
  return resolve(`electron/resources/build/${value}`)
}

export function whichResolve(command) {
  return which.sync(command, { nothrow: true, path: process.env.PATH })
}
