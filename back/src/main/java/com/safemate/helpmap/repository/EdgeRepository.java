package com.safemate.helpmap.repository;

import com.safemate.helpmap.entity.Edge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface EdgeRepository extends JpaRepository<Edge, Long> {

    boolean existsByRoadTypeIsNull();

    // 경로 탐색은 그래프 전체를 메모리에 올리므로 노드까지 한 번에 조회 (N+1 방지)
    @Query("select e from Edge e join fetch e.fromNode join fetch e.toNode")
    List<Edge> findAllWithNodes();
}
