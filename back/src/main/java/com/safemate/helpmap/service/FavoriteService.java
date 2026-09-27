package com.safemate.helpmap.service;

import com.safemate.helpmap.dto.FavoriteCreateRequest;
import com.safemate.helpmap.dto.FavoriteResponse;

import java.util.List;

public interface FavoriteService {

    FavoriteResponse create(FavoriteCreateRequest request);

    List<FavoriteResponse> findMine(String deviceId);

    void delete(Long favoriteId, String deviceId);
}
