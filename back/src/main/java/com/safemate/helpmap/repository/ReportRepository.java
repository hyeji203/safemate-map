package com.safemate.helpmap.repository;

import com.safemate.helpmap.entity.Member;
import com.safemate.helpmap.entity.Report;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ReportRepository extends JpaRepository<Report, Long> {
    List<Report> findByReporter_EmailOrderByCreatedAtDesc(String email);

    // 로그인 시 이 브라우저의 익명 제보를 계정으로 옮길 때 사용
    @Modifying
    @Query("update Report r set r.reporter = :to where r.reporter = :from")
    int changeReporter(@Param("from") Member from, @Param("to") Member to);
}
