package com.safemate.helpmap.controller;

import com.safemate.helpmap.dto.RouteResponse;
import com.safemate.helpmap.service.RouteService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/routes")
@RequiredArgsConstructor
public class RouteController {

    private final RouteService routeService;

    @GetMapping
    public RouteResponse findRoute(@RequestParam double fromLat, @RequestParam double fromLng,
                                   @RequestParam double toLat, @RequestParam double toLng) {
        return routeService.findShortestRoute(fromLat, fromLng, toLat, toLng);
    }
}
