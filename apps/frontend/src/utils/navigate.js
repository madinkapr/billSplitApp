// In-app navigation without a page reload (keeps the bill in progress): App listens to
// popstate and re-reads its route from the URL.
let navigatedInApp = false

// True once we've pushed a route ourselves — so "Back" can use history.back() safely
// instead of leaving the site when a page (e.g. /privacy) was opened directly.
export function canGoBackInApp() {
  return navigatedInApp
}

export function navigateTo(path) {
  navigatedInApp = true
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

// <a href> that still works as a normal link (new tab, middle click) but navigates
// in-app on a plain click.
export function inAppLinkClick(path) {
  return (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    navigateTo(path)
  }
}
