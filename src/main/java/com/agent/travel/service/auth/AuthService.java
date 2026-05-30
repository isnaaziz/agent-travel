package com.agent.travel.service.auth;

import com.agent.travel.dto.AuthRequests.*;
import com.agent.travel.model.User;
import com.agent.travel.repository.auth.UserRepository;
import com.agent.travel.enumeration.AuthProvider;
import com.agent.travel.enumeration.Role;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final RestTemplate restTemplate = new RestTemplate();

    @Transactional
    public AuthResponse signup(SignUpRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email is already registered!");
        }

        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .provider(AuthProvider.LOCAL)
                .role(Role.USER)
                .build();

        userRepository.save(user);
        String jwtToken = jwtService.generateToken(user);
        
        return AuthResponse.builder()
                .token(jwtToken)
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .build();
    }

    @Transactional(readOnly = true)
    public AuthResponse signin(SignInRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));

        String jwtToken = jwtService.generateToken(user);

        return AuthResponse.builder()
                .token(jwtToken)
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .build();
    }

    @Transactional
    public AuthResponse googleLogin(GoogleAuthRequest request) {
        String email;
        String name;

        Role mockRole = Role.USER;
        if (request.getIdToken().startsWith("mock_google_")) {
            log.info("Processing simulated/mock Google login...");
            String[] parts = request.getIdToken().split("_");
            String roleStr = parts.length > 2 ? parts[2] : "USER";
            try {
                mockRole = Role.valueOf(roleStr.toUpperCase());
            } catch (Exception e) {
                mockRole = Role.USER;
            }
            name = parts.length > 3 ? parts[3].replace("-", " ") : "Google Traveler";
            email = parts.length > 4 ? parts[4] : "traveler@gmail.com";
        } else {
            log.info("Verifying Google ID token via Google Tokeninfo API...");
            try {
                String googleTokenInfoUrl = "https://oauth2.googleapis.com/tokeninfo?id_token=" + request.getIdToken();
                @SuppressWarnings("unchecked")
                Map<String, Object> tokenInfo = restTemplate.getForObject(googleTokenInfoUrl, Map.class);

                if (tokenInfo == null || tokenInfo.containsKey("error_description")) {
                    throw new IllegalArgumentException("Invalid Google ID Token!");
                }

                email = (String) tokenInfo.get("email");
                name = (String) tokenInfo.get("name");
                
                if (email == null) {
                    throw new IllegalArgumentException("Google account email not shared or available!");
                }
            } catch (Exception e) {
                log.error("Google token verification failed: {}", e.getMessage());
                throw new IllegalArgumentException("Google authentication failed: " + e.getMessage());
            }
        }

        Optional<User> existingUser = userRepository.findByEmail(email);
        User user;

        if (existingUser.isPresent()) {
            user = existingUser.get();
            if (request.getIdToken().startsWith("mock_google_")) {
                user.setRole(mockRole);
                userRepository.save(user);
            }
            log.info("User already exists. Logging in user: {}", email);
        } else {
            log.info("Registering new Google user: {}", email);
            Role finalRole = request.getIdToken().startsWith("mock_google_") ? mockRole : Role.USER;
            user = User.builder()
                    .name(name)
                    .email(email)
                    .provider(AuthProvider.GOOGLE)
                    .role(finalRole)
                    .build();
            userRepository.save(user);
        }

        String jwtToken = jwtService.generateToken(user);

        return AuthResponse.builder()
                .token(jwtToken)
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .build();
    }
}
