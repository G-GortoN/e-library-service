package dev.elibrary;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

@RestController
class ApiDocsController {
  @GetMapping(value = "/api/docs", produces = MediaType.TEXT_HTML_VALUE)
  String docs() {
    return """
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>E-Library API / 电子图书馆 API</title><link rel="stylesheet" href="/api/swagger-ui/swagger-ui.css"></head>
<body style="margin:0"><div style="padding:16px 24px;background:#123d35;color:white;font-family:system-ui"><strong>E-Library API / 电子图书馆 API</strong><p>Use the login endpoint first; unsafe calls fetch CSRF automatically. / 请先调用登录接口，写操作会自动获取 CSRF。<br>Demo settlement never processes real payments. / 演示结清不会实际扣款。</p></div><div id="swagger-ui"></div><script src="/api/swagger-ui/swagger-ui-bundle.js"></script><script src="/api/docs-ui.js"></script></body></html>
""";
  }
}
