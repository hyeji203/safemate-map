package com.safemate.helpmap.dto;

import com.safemate.helpmap.entity.Favorite;

import java.time.LocalDateTime;

public record FavoriteResponse(
        Long id,
        String label,
        double latitude,
        double longitude,
        String address,
        LocalDateTime createdAt
) {
    public static FavoriteResponse from(Favorite favorite) {
        return new FavoriteResponse(
                favorite.getId(),
                favorite.getLabel(),
                favorite.getLatitude(),
                favorite.getLongitude(),
                favorite.getAddress(),
                favorite.getCreatedAt()
        );
    }
}
