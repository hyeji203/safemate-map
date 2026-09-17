package com.safemate.helpmap.repository;

import com.safemate.helpmap.entity.Report;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportRepository extends JpaRepository<Report, Long> {
}
