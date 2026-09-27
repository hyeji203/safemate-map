package com.safemate.helpmap.repository;

import com.safemate.helpmap.entity.Favorite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FavoriteRepository extends JpaRepository<Favorite, Long> {
    List<Favorite> findByOwner_EmailOrderByCreatedAtDesc(String email);
}
