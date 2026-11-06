export async function onRequest(context) {
  const origin = context.request.headers.get('Origin') || '*'

  // Handle CORS preflight (OPTIONS)
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin === 'null' ? '*' : origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
        'Access-Control-Allow-Headers': context.request.headers.get('Access-Control-Request-Headers') || '*',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  const url = new URL(context.request.url)
  const targetUrl = `http://api.ssasaleshub.cloud:8080${url.pathname}${url.search}`

  const headers = new Headers(context.request.headers)
  headers.delete('origin')
  headers.delete('referer')

  // Secure Worker-to-Origin authentication:
  // Strip any client-supplied header to prevent spoofing, then inject private secret
  headers.delete('x-origin-verify')
  headers.delete('X-Origin-Verify')
  if (context.env && context.env.ORIGIN_SECRET) {
    headers.set('X-Origin-Verify', context.env.ORIGIN_SECRET)
  }

  const init = {
    method: context.request.method,
    headers,
    redirect: 'follow',
  }

  if (!['GET', 'HEAD'].includes(context.request.method)) {
    init.body = context.request.body
  }

  try {
    const response = await fetch(targetUrl, init)

    // Clone headers to inject full CORS support
    const responseHeaders = new Headers(response.headers)
    responseHeaders.set('Access-Control-Allow-Origin', origin === 'null' ? '*' : origin)
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD')
    responseHeaders.set('Access-Control-Allow-Headers', '*')
    responseHeaders.set('Access-Control-Allow-Credentials', 'true')
    responseHeaders.set('Access-Control-Expose-Headers', 'Authorization, Link, X-Total-Count, X-Alert, X-Error')

    const body = [204, 304].includes(response.status) ? null : response.body

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Upstream gateway error' }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin === 'null' ? '*' : origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
    })
  }
}

