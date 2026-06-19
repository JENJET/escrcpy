import window from './window.js'

export default {
  name: 'module:sidebar',
  apply(mainApp) {
    mainApp.use(window)
  },
}
