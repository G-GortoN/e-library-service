/* Self-hosted Swagger UI: cookies stay HttpOnly; CSRF is acquired just in time. */
window.addEventListener('load', () => {
  window.ui = SwaggerUIBundle({
    url: '/api/openapi',
    dom_id: '#swagger-ui',
    deepLinking: true,
    layout: 'BaseLayout',
    withCredentials: true,
    persistAuthorization: false,
    requestInterceptor: async request => {
      request.credentials = 'same-origin';
      if (!['GET', 'HEAD', 'OPTIONS'].includes((request.method || 'GET').toUpperCase())) {
        const response = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to get CSRF token / 无法获取 CSRF 令牌');
        const csrf = await response.json();
        request.headers[csrf.headerName] = csrf.token;
      }
      return request;
    }
  });
});
