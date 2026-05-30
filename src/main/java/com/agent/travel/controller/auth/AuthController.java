package com.agent.travel.controller.auth;

import com.agent.travel.dto.ApiResponse;
import com.agent.travel.dto.AuthRequests.*;
import com.agent.travel.service.auth.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Tag(name = "Authentication", description = "Endpoints for user registration, login, and Google Sign-In")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/signup")
    @Operation(summary = "Register a new local user account")
    public ResponseEntity<ApiResponse<AuthResponse>> signup(@Valid @RequestBody SignUpRequest request, HttpServletResponse response) {
        AuthResponse authResponse = authService.signup(request);
        setJwtCookie(response, authResponse.getToken());
        return new ResponseEntity<>(ApiResponse.success("User registered successfully", authResponse), HttpStatus.CREATED);
    }

    @PostMapping("/signin")
    @Operation(summary = "Sign in to an existing local user account")
    public ResponseEntity<ApiResponse<AuthResponse>> signin(@Valid @RequestBody SignInRequest request, HttpServletResponse response) {
        AuthResponse authResponse = authService.signin(request);
        setJwtCookie(response, authResponse.getToken());
        return ResponseEntity.ok(ApiResponse.success("Login successful", authResponse));
    }

    @PostMapping("/google")
    @Operation(summary = "Authenticate or register automatically using Google ID Token")
    public ResponseEntity<ApiResponse<AuthResponse>> googleLogin(@Valid @RequestBody GoogleAuthRequest request, HttpServletResponse response) {
        AuthResponse authResponse = authService.googleLogin(request);
        setJwtCookie(response, authResponse.getToken());
        return ResponseEntity.ok(ApiResponse.success("Google login successful", authResponse));
    }

    @PostMapping("/signout")
    @Operation(summary = "Sign out and clear authentication cookies")
    public ResponseEntity<ApiResponse<Void>> signout(HttpServletResponse response) {
        ResponseCookie jwtCookie = ResponseCookie.from("JWT-TOKEN", "")
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(0)
                .sameSite("Lax")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, jwtCookie.toString());

        ResponseCookie csrfCookie = ResponseCookie.from("XSRF-TOKEN", "")
                .httpOnly(false)
                .secure(false)
                .path("/")
                .maxAge(0)
                .sameSite("Lax")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, csrfCookie.toString());

        return ResponseEntity.ok(ApiResponse.success("Logout successful", null));
    }

    private void setJwtCookie(HttpServletResponse response, String jwtToken) {
        ResponseCookie cookie = ResponseCookie.from("JWT-TOKEN", jwtToken)
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(86400)
                .sameSite("Lax")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
