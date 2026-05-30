package com.agent.travel.repository.booking;

import com.agent.travel.model.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {
    
    List<Booking> findByCustomerEmailIgnoreCase(String email);
    
    List<Booking> findByCustomerNameContainingIgnoreCase(String customerName);

    List<Booking> findByDestinationId(Long destinationId);
}
