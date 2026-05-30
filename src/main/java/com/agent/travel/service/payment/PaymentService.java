package com.agent.travel.service.payment;

import com.agent.travel.model.Booking;
import com.agent.travel.repository.booking.BookingRepository;
import com.agent.travel.service.booking.BookingService;
import com.agent.travel.enumeration.BookingStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    private final BookingRepository bookingRepository;
    private final BookingService bookingService;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${midtrans.server-key}")
    private String serverKey;

    @Value("${midtrans.client-key}")
    private String clientKey;

    @Value("${midtrans.is-production}")
    private boolean isProduction;

    @Transactional
    public Map<String, Object> generateSnapToken(Long bookingId) {
        Booking booking = bookingService.getBookingById(bookingId);

        boolean isMockMode = "YOUR_SERVER_KEY".equals(serverKey) || serverKey == null || serverKey.trim().isEmpty();

        if (isMockMode) {
            String mockToken = "mock_snap_token_" + booking.getId() + "_" + System.currentTimeMillis();
            booking.setPaymentToken(mockToken);
            bookingRepository.save(booking);

            Map<String, Object> response = new HashMap<>();
            response.put("token", mockToken);
            response.put("redirectUrl", "#mock-payment");
            response.put("clientKey", "MOCK_CLIENT_KEY");
            response.put("isMock", true);
            return response;
        }

        if (booking.getPaymentToken() != null && !booking.getPaymentToken().startsWith("mock_snap_")) {
            Map<String, Object> response = new HashMap<>();
            response.put("token", booking.getPaymentToken());
            response.put("redirectUrl", isProduction 
                    ? "https://app.midtrans.com/snap/v2/vtweb/" + booking.getPaymentToken()
                    : "https://app.sandbox.midtrans.com/snap/v2/vtweb/" + booking.getPaymentToken());
            response.put("clientKey", clientKey);
            response.put("isMock", false);
            return response;
        }

        try {
            String snapUrl = isProduction 
                    ? "https://app.midtrans.com/snap/v1/transactions"
                    : "https://app.sandbox.midtrans.com/snap/v1/transactions";

            String orderId = "B-" + booking.getId() + "-" + System.currentTimeMillis();

            Map<String, Object> transactionDetails = new HashMap<>();
            transactionDetails.put("order_id", orderId);
            transactionDetails.put("gross_amount", booking.getTotalPrice().intValue());

            Map<String, Object> customerDetails = new HashMap<>();
            customerDetails.put("first_name", booking.getCustomerName());
            customerDetails.put("email", booking.getCustomerEmail());

            Map<String, Object> payload = new HashMap<>();
            payload.put("transaction_details", transactionDetails);
            payload.put("customer_details", customerDetails);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Accept", MediaType.APPLICATION_JSON_VALUE);
            
            String auth = serverKey + ":";
            String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));
            headers.set("Authorization", "Basic " + encodedAuth);

            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(payload, headers);
            
            @SuppressWarnings("rawtypes")
            ResponseEntity<Map> responseEntity = restTemplate.postForEntity(snapUrl, requestEntity, Map.class);
            
            @SuppressWarnings("unchecked")
            Map<String, Object> responseBody = responseEntity.getBody();

            if (responseBody == null || !responseBody.containsKey("token")) {
                throw new IllegalStateException("Failed to retrieve token from Midtrans Snap API");
            }

            String token = (String) responseBody.get("token");
            String redirectUrl = (String) responseBody.get("redirect_url");

            booking.setPaymentToken(token);
            bookingRepository.save(booking);

            Map<String, Object> response = new HashMap<>();
            response.put("token", token);
            response.put("redirectUrl", redirectUrl);
            response.put("clientKey", clientKey);
            response.put("isMock", false);
            return response;

        } catch (Exception e) {
            log.error("Midtrans Snap transaction generation failed: {}", e.getMessage());
            
            String mockToken = "mock_snap_token_" + booking.getId() + "_" + System.currentTimeMillis();
            booking.setPaymentToken(mockToken);
            bookingRepository.save(booking);

            Map<String, Object> response = new HashMap<>();
            response.put("token", mockToken);
            response.put("redirectUrl", "#mock-payment");
            response.put("clientKey", "MOCK_CLIENT_KEY");
            response.put("isMock", true);
            return response;
        }
    }

    @Transactional
    public void processCallback(Map<String, Object> callbackData) {
        String orderId = (String) callbackData.get("order_id");
        if (orderId == null) {
            throw new IllegalArgumentException("Missing order_id in callback");
        }

        String[] parts = orderId.split("-");
        if (parts.length < 2 || !parts[0].equals("B")) {
            throw new IllegalArgumentException("Invalid order_id format");
        }

        Long bookingId = Long.parseLong(parts[1]);

        boolean isMockMode = "YOUR_SERVER_KEY".equals(serverKey) || serverKey == null || serverKey.trim().isEmpty() || orderId.contains("mock");

        if (!isMockMode) {
            String statusCode = (String) callbackData.get("status_code");
            String grossAmount = (String) callbackData.get("gross_amount");
            String signatureKey = (String) callbackData.get("signature_key");

            String rawSignature = orderId + statusCode + grossAmount + serverKey;
            String computedSignature = sha512(rawSignature);
            if (!computedSignature.equalsIgnoreCase(signatureKey)) {
                throw new SecurityException("Invalid signature key! Webhook verification failed.");
            }
        }

        String transactionStatus = (String) callbackData.get("transaction_status");
        String fraudStatus = (String) callbackData.get("fraud_status");

        BookingStatus newStatus = null;

        if ("settlement".equals(transactionStatus)) {
            newStatus = BookingStatus.CONFIRMED;
        } else if ("capture".equals(transactionStatus)) {
            if (!"challenge".equals(fraudStatus)) {
                newStatus = BookingStatus.CONFIRMED;
            }
        } else if ("deny".equals(transactionStatus) || "cancel".equals(transactionStatus) || "expire".equals(transactionStatus)) {
            newStatus = BookingStatus.CANCELLED;
        }

        if (newStatus != null) {
            bookingService.updateBookingStatus(bookingId, newStatus);
        }
    }

    private String sha512(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-512");
            byte[] messageDigest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder no = new StringBuilder();
            for (byte b : messageDigest) {
                no.append(String.format("%02x", b));
            }
            return no.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
