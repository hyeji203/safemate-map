package com.safemate.helpmap.controller;

import com.safemate.helpmap.dto.NodeResponse;
import com.safemate.helpmap.repository.NodeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/nodes")
@RequiredArgsConstructor
public class NodeController {

    private final NodeRepository nodeRepository;

    @GetMapping
    public List<NodeResponse> findAll() {
        return nodeRepository.findAll().stream()
                .map(n -> new NodeResponse(n.getId(), n.getName(), n.getLatitude(), n.getLongitude()))
                .toList();
    }
}
