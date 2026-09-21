package com.safemate.helpmap.controller;

import com.safemate.helpmap.dto.StreetLightResponse;
import com.safemate.helpmap.repository.StreetLightRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/street-lights")
@RequiredArgsConstructor
public class StreetLightController {

    private final StreetLightRepository streetLightRepository;

    @GetMapping
    public List<StreetLightResponse> findAll() {
        return streetLightRepository.findAll().stream()
                .map(l -> new StreetLightResponse(l.getId(), l.getLatitude(), l.getLongitude()))
                .toList();
    }
}
