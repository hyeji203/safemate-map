package com.safemate.helpmap.repository;

import com.safemate.helpmap.entity.Favorite;
import com.safemate.helpmap.entity.Member;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface FavoriteRepository extends JpaRepository<Favorite, Long> {
    List<Favorite> findByOwner_EmailOrderByCreatedAtDesc(String email);

    // 로그인 시 이 브라우저의 익명 즐겨찾기를 계정으로 옮길 때 사용
    @Modifying
    @Query("update Favorite f set f.owner = :to where f.owner = :from")
    int changeOwner(@Param("from") Member from, @Param("to") Member to);

    // 회원탈퇴 시 그 회원의 즐겨찾기를 모두 지운다
    @Modifying
    @Query("delete from Favorite f where f.owner = :owner")
    int deleteByOwner(@Param("owner") Member owner);
}
