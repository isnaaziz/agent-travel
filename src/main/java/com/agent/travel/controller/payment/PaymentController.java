package com.agent.travel.controller.payment;

import com.agent.travel.dto.ApiResponse;
import com.agent.travel.service.payment.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Tag(name = "Payments", description = "Endpoints for processing traveler payments")
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/api/bookings/{id}/pay")
    @Operation(summary = "Initialize a payment for a pending booking and generate a Snap token")
    public ResponseEntity<ApiResponse<Map<String, Object>>> payBooking(@PathVariable Long id) {
        Map<String, Object> paymentData = paymentService.generateSnapToken(id);
        return ResponseEntity.ok(ApiResponse.success("Payment initiated successfully", paymentData));
    }

    @PostMapping("/api/payments/callback")
    @Operation(summary = "Webhook notification callback endpoint for Midtrans payments")
    public ResponseEntity<ApiResponse<Void>> paymentCallback(@RequestBody Map<String, Object> callbackData) {
        paymentService.processCallback(callbackData);
        return ResponseEntity.ok(ApiResponse.success("Callback processed successfully"));
    }
}
