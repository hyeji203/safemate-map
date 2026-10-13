package com.safemate.helpmap.dto;

public record CctvResponse(Long id, double latitude, double longitude, String purpose, int cameraCount) {
}
