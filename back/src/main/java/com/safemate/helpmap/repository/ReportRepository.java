package com.safemate.helpmap.repository;

import com.safemate.helpmap.entity.Report;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReportRepository extends JpaRepository<Report, Long> {
    List<Report> findByReporter_EmailOrderByCreatedAtDesc(String email);
}
