package com.agent.travel.config;

import com.agent.travel.service.auth.JwtService;
import com.agent.travel.repository.auth.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String extractedJwt = null;
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("JWT-TOKEN".equals(cookie.getName())) {
                    extractedJwt = cookie.getValue();
                    break;
                }
            }
        }

        if (extractedJwt == null) {
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                extractedJwt = authHeader.substring(7);
            }
        }

        if (extractedJwt == null) {
            filterChain.doFilter(request, response);
            return;
        }

        final String jwt = extractedJwt;
        final String userEmail;
        try {
            userEmail = jwtService.extractUsername(jwt);
            if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = userRepository.findByEmail(userEmail)
                        .orElseThrow(() -> new UsernameNotFoundException("User not found: " + userEmail));

                if (jwtService.isTokenValid(jwt, userDetails)) {
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            userDetails.getAuthorities()
                    );
                    authToken.setDetails(
                            new WebAuthenticationDetailsSource().buildDetails(request)
                    );
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                    log.debug("User authenticated successfully: {}, authorities: {}", userEmail, userDetails.getAuthorities());
                }
            }
        } catch (Exception e) {
            log.error("Cannot set user authentication: {}", e.getMessage());
        }

        filterChain.doFilter(request, response);
    }
}
