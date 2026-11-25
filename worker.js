async function handleApiRequest(request, env) {
  const origin = request.headers.get('Origin') || '*'
  const envName = (env.APP_ENV || 'development').toLowerCase()
  const targetBase = env.API_TARGET_URL || (
    envName === 'production' ? 'https://api.ssasaleshub.cloud:8080' : 'http://localhost:8080'
  )

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin === 'null' ? '*' : origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
        'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || '*',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  const url = new URL(request.url)
  const targetUrl = `${targetBase.replace(/\/$/, '')}${url.pathname}${url.search}`

  const headers = new Headers(request.headers)
  headers.delete('origin')
  headers.delete('referer')
  headers.delete('x-origin-verify')
  if (env.ORIGIN_SECRET) {
    headers.set('X-Origin-Verify', env.ORIGIN_SECRET)
  }

  const init = {
    method: request.method,
    headers,
    redirect: 'manual',
  }

  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = request.body
  }

  try {
    const response = await fetch(targetUrl, init)
    const responseHeaders = new Headers(response.headers)
    responseHeaders.set('Access-Control-Allow-Origin', origin === 'null' ? '*' : origin)
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD')
    responseHeaders.set('Access-Control-Allow-Headers', '*')
    responseHeaders.set('Access-Control-Allow-Credentials', 'true')
    responseHeaders.set('Access-Control-Expose-Headers', 'Authorization, Link, X-Total-Count, X-Alert, X-Error')

    return new Response([204, 304].includes(response.status) ? null : response.body, {
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

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)

    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return handleApiRequest(request, env)
    }

    return env.ASSETS.fetch(request)
  },
}
