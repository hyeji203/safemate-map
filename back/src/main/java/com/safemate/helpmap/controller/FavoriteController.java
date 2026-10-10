package com.safemate.helpmap.controller;

import com.safemate.helpmap.dto.FavoriteCreateRequest;
import com.safemate.helpmap.dto.FavoriteResponse;
import com.safemate.helpmap.service.FavoriteService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/favorites")
@RequiredArgsConstructor
public class FavoriteController {

    private final FavoriteService favoriteService;

    @PostMapping
    public ResponseEntity<FavoriteResponse> create(@RequestBody @Valid FavoriteRequestBody body) {
        var request = new FavoriteCreateRequest(body.deviceId(), body.label(), body.latitude(), body.longitude(), body.address());
        return ResponseEntity.status(HttpStatus.CREATED).body(favoriteService.create(request));
    }

    @GetMapping
    public List<FavoriteResponse> findMine(@RequestParam String deviceId) {
        return favoriteService.findMine(deviceId);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @RequestParam String deviceId) {
        favoriteService.delete(id, deviceId);
        return ResponseEntity.noContent().build();
    }

    private record FavoriteRequestBody(
            @NotBlank String deviceId,
            @NotBlank String label,
            double latitude,
            double longitude,
            String address
    ) {
    }
}
