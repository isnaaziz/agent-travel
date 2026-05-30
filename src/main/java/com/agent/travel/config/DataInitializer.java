package com.agent.travel.config;

import com.agent.travel.model.Destination;
import com.agent.travel.repository.destination.DestinationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final DestinationRepository destinationRepository;

    @Override
    public void run(String... args) {
        if (destinationRepository.count() == 0) {
            log.info("Database is empty. Seeding initial travel destinations...");

            List<Destination> initialDestinations = Arrays.asList(
                Destination.builder()
                    .name("Bali Escape")
                    .country("Indonesia")
                    .description("Explore the tropical paradise of Bali. Immerse yourself in beautiful sandy beaches, vibrant Hindu culture, ancient clifftop temples, and lush green rice terrace fields.")
                    .price(1200000.0)
                    .imageUrl("https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80")
                    .rating(4.9)
                    .build(),

                Destination.builder()
                    .name("Kyoto Heritage")
                    .country("Japan")
                    .description("Step back in time in Kyoto, the heart of traditional Japan. Discover magnificent wooden temples, peaceful zen gardens, imperial palaces, and breathtaking cherry blossoms in spring.")
                    .price(2500000.0)
                    .imageUrl("https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80")
                    .rating(4.8)
                    .build(),

                Destination.builder()
                    .name("Parisian Romance")
                    .country("France")
                    .description("Experience the elegance and romance of Paris. Marvel at the iconic Eiffel Tower, walk along the historic Seine River, and visit world-renowned art museums like the Louvre.")
                    .price(4200000.0)
                    .imageUrl("https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80")
                    .rating(4.7)
                    .build(),

                Destination.builder()
                    .name("Santorini Sunsets")
                    .country("Greece")
                    .description("Indulge in the iconic beauty of Santorini. Famous for its dazzling whitewashed buildings, blue-domed churches, dramatic volcanic cliffs, and legendary golden sunsets over the Aegean Sea.")
                    .price(3800000.0)
                    .imageUrl("https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80")
                    .rating(4.95)
                    .build(),

                Destination.builder()
                    .name("Swiss Alps Adventure")
                    .country("Switzerland")
                    .description("Experience the ultimate winter wonderland or pristine summer hiking in the Swiss Alps. Surrounded by snow-capped mountains, crystal clear alpine lakes, and charming wooden cabins.")
                    .price(4800000.0)
                    .imageUrl("https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80")
                    .rating(4.9)
                    .build()
            );

            destinationRepository.saveAll(initialDestinations);
            log.info("Successfully seeded {} destinations into the database.", initialDestinations.size());
        } else {
            log.info("Database already contains data. Skipping seeding.");
        }
    }
}
