export async function onRequest(context) {
  const url = new URL(context.request.url)
  const targetUrl = `http://api.ssasaleshub.cloud:8080${url.pathname}${url.search}`

  const headers = new Headers(context.request.headers)
  headers.delete('origin')
  headers.delete('referer')

  const init = {
    method: context.request.method,
    headers,
    redirect: 'follow',
  }

  if (!['GET', 'HEAD'].includes(context.request.method)) {
    init.body = context.request.body
  }

  return fetch(targetUrl, init)
}
