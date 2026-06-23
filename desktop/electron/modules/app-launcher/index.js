import window from './window.js'

export default {
  name: 'module:app-launcher',
  apply(mainApp) {
    mainApp.use(window)
  },
}
