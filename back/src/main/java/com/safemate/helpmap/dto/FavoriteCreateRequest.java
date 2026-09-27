package com.safemate.helpmap.dto;

public record FavoriteCreateRequest(
        String deviceId,
        String label,
        double latitude,
        double longitude
) {
}
