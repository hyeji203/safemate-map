package com.safemate.helpmap.service;

import com.safemate.helpmap.dto.FavoriteCreateRequest;
import com.safemate.helpmap.dto.FavoriteResponse;
import com.safemate.helpmap.entity.Favorite;
import com.safemate.helpmap.entity.Member;
import com.safemate.helpmap.repository.FavoriteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FavoriteServiceImpl implements FavoriteService {

    private final FavoriteRepository favoriteRepository;
    private final CurrentMemberService currentMemberService;

    @Override
    @Transactional
    public FavoriteResponse create(FavoriteCreateRequest request) {
        Member owner = currentMemberService.resolve(request.deviceId());
        Favorite favorite = new Favorite(owner, request.label(), request.latitude(), request.longitude());
        return FavoriteResponse.from(favoriteRepository.save(favorite));
    }

    @Override
    public List<FavoriteResponse> findMine(String deviceId) {
        String email = currentMemberService.currentEmail(deviceId);
        return favoriteRepository.findByOwner_EmailOrderByCreatedAtDesc(email).stream()
                .map(FavoriteResponse::from)
                .toList();
    }

    @Override
    @Transactional
    public void delete(Long favoriteId, String deviceId) {
        Favorite favorite = favoriteRepository.findById(favoriteId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "존재하지 않는 즐겨찾기입니다."));

        if (!favorite.getOwner().getEmail().equals(currentMemberService.currentEmail(deviceId))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인이 등록한 즐겨찾기만 삭제할 수 있습니다.");
        }
        favoriteRepository.delete(favorite);
    }
}
