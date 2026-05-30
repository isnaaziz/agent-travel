package com.agent.travel.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import com.agent.travel.enumeration.BookingStatus;

@Entity
@Table(name = "bookings")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Customer name is required")
    @Column(name = "customer_name", nullable = false)
    private String customerName;

    @NotBlank(message = "Customer email is required")
    @Email(message = "Invalid email format")
    @Column(name = "customer_email", nullable = false)
    private String customerEmail;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "destination_id", nullable = false)
    @NotNull(message = "Selected destination is required")
    private Destination destination;

    @Column(name = "booking_date", nullable = false)
    private LocalDateTime bookingDate;

    @NotNull(message = "Travel date is required")
    @FutureOrPresent(message = "Travel date must be in the present or future")
    @Column(name = "travel_date", nullable = false)
    private LocalDate travelDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BookingStatus status;

    @NotNull(message = "Duration is required")
    @jakarta.validation.constraints.Min(value = 1, message = "Duration must be at least 1 day")
    @Column(nullable = false)
    private Integer duration;

    @Column(name = "total_price", nullable = false)
    private Double totalPrice;

    @Column(name = "payment_token")
    private String paymentToken;

}
