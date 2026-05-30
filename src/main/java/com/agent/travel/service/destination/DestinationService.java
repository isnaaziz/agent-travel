package com.agent.travel.service.destination;

import com.agent.travel.exception.ResourceNotFoundException;
import com.agent.travel.model.Destination;
import com.agent.travel.repository.destination.DestinationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DestinationService {

    private final DestinationRepository destinationRepository;

    @Transactional(readOnly = true)
    public List<Destination> getAllDestinations() {
        return destinationRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<Destination> searchDestinations(String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return getAllDestinations();
        }
        return destinationRepository.searchDestinations(keyword);
    }

    @Transactional(readOnly = true)
    public Destination getDestinationById(Long id) {
        return destinationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Destination not found with id: " + id));
    }

    @Transactional
    public Destination createDestination(Destination destination) {
        return destinationRepository.save(destination);
    }

    @Transactional
    public Destination updateDestination(Long id, Destination details) {
        Destination destination = getDestinationById(id);
        destination.setName(details.getName());
        destination.setCountry(details.getCountry());
        destination.setDescription(details.getDescription());
        destination.setPrice(details.getPrice());
        destination.setImageUrl(details.getImageUrl());
        destination.setRating(details.getRating());
        return destinationRepository.save(destination);
    }

    @Transactional
    public void deleteDestination(Long id) {
        Destination destination = getDestinationById(id);
        destinationRepository.delete(destination);
    }
}
