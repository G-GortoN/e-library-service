package dev.elibrary;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.io.Serializable;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextHolderFilter;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
class SecurityConfig {
  record SessionUser(long id, String email, String role, long version) implements Serializable {}

  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);
  }

  @Bean
  HttpSessionSecurityContextRepository contextRepository() {
    return new HttpSessionSecurityContextRepository();
  }

  @Bean
  HttpSessionCsrfTokenRepository csrfRepository() {
    return new HttpSessionCsrfTokenRepository();
  }

  @Bean
  SecurityFilterChain filterChain(
      HttpSecurity http,
      Store store,
      HttpSessionSecurityContextRepository contexts,
      HttpSessionCsrfTokenRepository csrf)
      throws Exception {
    http.securityContext(c -> c.securityContextRepository(contexts))
        .csrf(
            c ->
                c.csrfTokenRepository(csrf)
                    .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
        .authorizeHttpRequests(
            a ->
                a.requestMatchers(
                        "/actuator/health",
                        "/api/v1/health",
                        "/api/v1/auth/**",
                        "/api/v1/books/**",
                        "/api/v1/categories",
                        "/api/v1/recommendations",
                        "/api/v1/media/**",
                        "/api/docs",
                        "/api/docs-ui.js",
                        "/api/docs-internal/**",
                        "/api/swagger-ui/**",
                        "/api/docs/**",
                        "/api/openapi/**",
                        "/v3/api-docs/**",
                        "/swagger-ui/**",
                        "/swagger-ui.html")
                    .permitAll()
                    .requestMatchers("/api/v1/admin/**")
                    .hasRole("ADMIN")
                    .anyRequest()
                    .authenticated())
        .exceptionHandling(
            e ->
                e.authenticationEntryPoint(
                        (req, res, ex) ->
                            writeError(res, 401, "UNAUTHENTICATED", "Sign in to continue / 请先登录"))
                    .accessDeniedHandler(
                        (req, res, ex) ->
                            writeError(
                                res,
                                403,
                                "ACCESS_DENIED",
                                "Access denied or CSRF token missing / 无权限或缺少 CSRF 令牌")))
        .logout(l -> l.disable())
        .formLogin(f -> f.disable())
        .httpBasic(b -> b.disable())
        .addFilterAfter(new FreshSessionFilter(store), SecurityContextHolderFilter.class);
    return http.build();
  }

  static SessionUser user() {
    var auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null || !(auth.getPrincipal() instanceof SessionUser user))
      throw new ApiException(
          HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Sign in to continue / 请先登录");
    return user;
  }

  static SessionUser optionalUser() {
    var auth = SecurityContextHolder.getContext().getAuthentication();
    return auth != null && auth.getPrincipal() instanceof SessionUser user ? user : null;
  }

  static void writeError(HttpServletResponse res, int status, String code, String message)
      throws IOException {
    res.setStatus(status);
    res.setContentType("application/problem+json;charset=UTF-8");
    res.getWriter()
        .write(
            "{\"status\":"
                + status
                + ",\"title\":\""
                + code
                + "\",\"code\":\""
                + code
                + "\",\"detail\":\""
                + message
                + "\"}");
  }

  static class FreshSessionFilter extends OncePerRequestFilter {
    private final Store store;

    FreshSessionFilter(Store store) {
      this.store = store;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
      var user = optionalUser();
      if (user != null) {
        var row =
            store.optional("select enabled,session_version from app_user where id=?", user.id());
        if (row.isEmpty()
            || !Boolean.TRUE.equals(row.get().get("enabled"))
            || ((Number) row.get().get("sessionVersion")).longValue() != user.version()) {
          SecurityContextHolder.clearContext();
          var session = request.getSession(false);
          if (session != null) session.invalidate();
        }
      }
      chain.doFilter(request, response);
    }
  }
}
