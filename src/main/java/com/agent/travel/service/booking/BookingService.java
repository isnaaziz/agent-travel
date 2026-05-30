package com.agent.travel.service.booking;

import com.agent.travel.dto.BookingRequest;
import com.agent.travel.exception.ResourceNotFoundException;
import com.agent.travel.model.Booking;
import com.agent.travel.model.Destination;
import com.agent.travel.model.User;
import com.agent.travel.repository.booking.BookingRepository;
import com.agent.travel.service.destination.DestinationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookingRepository;
    private final DestinationService destinationService;

    @Transactional(readOnly = true)
    public List<Booking> getAllBookings(User user) {
        if (user.getRole() == User.Role.ADMIN || user.getRole() == User.Role.OPERATOR) {
            return bookingRepository.findAll();
        } else {
            return bookingRepository.findByCustomerEmailIgnoreCase(user.getEmail());
        }
    }

    @Transactional(readOnly = true)
    public Booking getBookingById(Long id) {
        return bookingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found with id: " + id));
    }

    @Transactional
    public Booking createBooking(BookingRequest request) {
        Destination destination = destinationService.getDestinationById(request.getDestinationId());

        Booking booking = Booking.builder()
                .customerName(request.getCustomerName())
                .customerEmail(request.getCustomerEmail())
                .destination(destination)
                .bookingDate(LocalDateTime.now())
                .travelDate(request.getTravelDate())
                .status(Booking.BookingStatus.PENDING)
                .duration(request.getDuration())
                .totalPrice(destination.getPrice() * request.getDuration())
                .build();

        return bookingRepository.save(booking);
    }

    @Transactional
    public Booking updateBookingStatus(Long id, Booking.BookingStatus status) {
        Booking booking = getBookingById(id);
        booking.setStatus(status);
        return bookingRepository.save(booking);
    }

    @Transactional
    public void cancelBooking(Long id) {
        Booking booking = getBookingById(id);
        booking.setStatus(Booking.BookingStatus.CANCELLED);
        bookingRepository.save(booking);
    }
}
