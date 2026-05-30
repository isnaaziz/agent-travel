package com.agent.travel.repository.destination;

import com.agent.travel.model.Destination;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DestinationRepository extends JpaRepository<Destination, Long> {
    
    List<Destination> findByCountryContainingIgnoreCase(String country);

    @Query("SELECT d FROM Destination d WHERE " +
           "LOWER(d.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(d.country) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    List<Destination> searchDestinations(@Param("keyword") String keyword);
}
