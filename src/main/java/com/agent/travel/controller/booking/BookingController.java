package com.agent.travel.controller.booking;

import com.agent.travel.dto.ApiResponse;
import com.agent.travel.dto.BookingRequest;
import com.agent.travel.model.Booking;
import com.agent.travel.model.User;
import com.agent.travel.service.booking.BookingService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.agent.travel.enumeration.BookingStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Tag(name = "Bookings", description = "Endpoints for managing customer bookings")
public class BookingController {

    private final BookingService bookingService;

    @GetMapping
    @Operation(summary = "Get bookings (dynamically filtered by user role)")
    public ResponseEntity<ApiResponse<List<Booking>>> getAllBookings(@AuthenticationPrincipal User user) {
        List<Booking> bookings = bookingService.getAllBookings(user);
        return ResponseEntity.ok(ApiResponse.success("Bookings retrieved successfully", bookings));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get booking details by ID")
    public ResponseEntity<ApiResponse<Booking>> getBookingById(@PathVariable Long id) {
        Booking booking = bookingService.getBookingById(id);
        return ResponseEntity.ok(ApiResponse.success("Booking details retrieved successfully", booking));
    }

    @PostMapping
    @Operation(summary = "Create a new booking")
    public ResponseEntity<ApiResponse<Booking>> createBooking(@Valid @RequestBody BookingRequest request) {
        Booking booking = bookingService.createBooking(request);
        return new ResponseEntity<>(ApiResponse.success("Booking created successfully", booking), HttpStatus.CREATED);
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Update booking status (CONFIRMED, CANCELLED, etc.)")
    public ResponseEntity<ApiResponse<Booking>> updateBookingStatus(
            @PathVariable Long id,
            @RequestParam BookingStatus status) {
        Booking updatedBooking = bookingService.updateBookingStatus(id, status);
        return ResponseEntity.ok(ApiResponse.success("Booking status updated successfully", updatedBooking));
    }

    @PutMapping("/{id}/cancel")
    @Operation(summary = "Cancel a booking")
    public ResponseEntity<ApiResponse<Void>> cancelBooking(@PathVariable Long id) {
        bookingService.cancelBooking(id);
        return ResponseEntity.ok(ApiResponse.success("Booking cancelled successfully"));
    }
}
