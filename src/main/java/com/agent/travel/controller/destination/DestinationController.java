package com.agent.travel.controller.destination;

import com.agent.travel.dto.ApiResponse;
import com.agent.travel.model.Destination;
import com.agent.travel.service.destination.DestinationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/destinations")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Tag(name = "Destinations", description = "Endpoints for managing travel destinations")
public class DestinationController {

    private final DestinationService destinationService;

    @GetMapping
    @Operation(summary = "Get all destinations or search by keyword (name/country)")
    public ResponseEntity<ApiResponse<List<Destination>>> getAllDestinations(
            @RequestParam(required = false) String keyword) {
        List<Destination> destinations = destinationService.searchDestinations(keyword);
        return ResponseEntity.ok(ApiResponse.success("Destinations retrieved successfully", destinations));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get destination details by ID")
    public ResponseEntity<ApiResponse<Destination>> getDestinationById(@PathVariable Long id) {
        Destination destination = destinationService.getDestinationById(id);
        return ResponseEntity.ok(ApiResponse.success("Destination details retrieved successfully", destination));
    }

    @PostMapping
    @Operation(summary = "Create a new travel destination")
    public ResponseEntity<ApiResponse<Destination>> createDestination(@Valid @RequestBody Destination destination) {
        Destination savedDestination = destinationService.createDestination(destination);
        return new ResponseEntity<>(ApiResponse.success("Destination created successfully", savedDestination), HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update an existing travel destination")
    public ResponseEntity<ApiResponse<Destination>> updateDestination(
            @PathVariable Long id,
            @Valid @RequestBody Destination destinationDetails) {
        Destination updatedDestination = destinationService.updateDestination(id, destinationDetails);
        return ResponseEntity.ok(ApiResponse.success("Destination updated successfully", updatedDestination));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a travel destination")
    public ResponseEntity<ApiResponse<Void>> deleteDestination(@PathVariable Long id) {
        destinationService.deleteDestination(id);
        return ResponseEntity.ok(ApiResponse.success("Destination deleted successfully"));
    }
}
